#!/usr/bin/env python3
"""Convert a Notion "Markdown & CSV" export of the Recipes + Grocery databases into a
Kitchen import file (JSON), which the app's #/import screen loads.

    python3 notion_to_kitchen.py <recipes-folder> <grocery_all.csv> <out.json>

<recipes-folder> holds one .md per recipe (title, a "Key: value" property block, then the page).
Nothing is lost: page text that can't be read as ingredients or steps goes into Notes.
"""
import csv, json, re, sys, glob, os, datetime, difflib

# ---------- mapping choices (agreed with Grace) ----------
TAG_ALIASES = {"drink": "Drink", "drinks": "Drink", "go to": "Go-to", "go-to": "Go-to", "new": "New",
               "lunch/dinner": "Lunch/Dinner", "veggies": "Veggies", "carbs": "Carbs"}
SKIP_TAGS = {"hide", "ingredients"}            # "hide" → archived instead of a tag
STOCK = {"yes": "in_stock", "low": "low", "no": "out", "buy": "out"}   # anything else → not_tracked
CATEGORY = {"veggie & fruit": "Produce", "protein": "Protein", "seafood": "Protein", "dairy": "Dairy",
            "herbs & spices": "Herbs & Spices", "supplies": "Household", "personal": "Household", "pharmacy": "Household"}
DEFAULT_SERVINGS = 4

UNITS = {
    "tablespoons": "tbsp", "tablespoon": "tbsp", "tbsp": "tbsp", "tbs": "tbsp", "tbsps": "tbsp", "t": "tbsp",
    "teaspoons": "tsp", "teaspoon": "tsp", "tsp": "tsp", "tsps": "tsp",
    "cups": "cup", "cup": "cup", "c": "cup",
    "pounds": "lb", "pound": "lb", "lbs": "lb", "lb": "lb",
    "ounces": "oz", "ounce": "oz", "oz": "oz",
    "grams": "g", "gram": "g", "g": "g", "kilograms": "kg", "kg": "kg",
    "milliliters": "ml", "ml": "ml", "liters": "l", "liter": "l", "l": "l",
    "cloves": "clove", "clove": "clove", "cans": "can", "can": "can", "jar": "jar", "jars": "jar",
    "packages": "package", "package": "package", "pkg": "package", "bunches": "bunch", "bunch": "bunch",
    "sprigs": "sprig", "sprig": "sprig", "pinch": "pinch", "pinches": "pinch", "slices": "slice", "slice": "slice",
    "stalks": "stalk", "stalk": "stalk", "heads": "head", "head": "head", "sticks": "stick", "stick": "stick",
    "quarts": "quart", "quart": "quart", "pints": "pint", "pint": "pint", "handful": "handful", "dash": "dash",
}
FRAC = {"½": .5, "⅓": 1/3, "⅔": 2/3, "¼": .25, "¾": .75, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875, "⅕": .2}
WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "a": 1, "an": 1, "half": .5}
SECTION = re.compile(r"^[-*#\s]*\**\s*(ingredients?|instructions?|directions?|method|steps|preparation|prep|recipe|notes?|to serve|for serving)\s*:?\s*\**\s*:?\s*$", re.I)


def clean_md(s):
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)                 # images
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)            # links → text
    s = s.replace("**", "").replace("__", "")
    return re.sub(r"\s+", " ", s).strip()


def strip_marker(line):
    line = re.sub(r"^\s*(?:[-*•]\s+|\d+[.)]\s+|#+\s*)", "", line)
    return re.sub(r"^\[[ xX]?\]\s*", "", line)          # Notion to-do boxes


def parse_props(text):
    lines = text.split("\n")
    title = lines[0].lstrip("# ").strip()
    props, i = {}, 1
    while i < len(lines) and not lines[i].strip(): i += 1
    while i < len(lines) and lines[i].strip():
        m = re.match(r"^([^:]{1,60}):\s?(.*)$", lines[i])
        if not m: break
        props[m.group(1).strip()] = m.group(2).strip(); i += 1
    return title, props, "\n".join(lines[i:])


def rel_names(v):
    """'Garlic (https://…), Oil - Olive oil (https://…)' → ['Garlic', 'Oil - Olive oil']"""
    return [n.strip() for n in re.findall(r"([^,]+?) \(https?://[^)]*\)", v or "")]


def nice_grocery(name):
    """Notion grocery names use 'Category - item' ('Oil - Olive oil'); the app wants 'Olive oil'."""
    n = name.strip()
    m = re.match(r"^([A-Za-z &]+?)\s*[-–—]\s*(.+)$", n)
    if m and len(m.group(1).split()) <= 2: n = m.group(2)
    return n[:1].upper() + n[1:]


def parse_amount(s):
    s = s.strip()
    for k, v in FRAC.items(): s = re.sub(rf"(\d)\s*{k}", lambda m: f"{m.group(1)} {k}", s)
    tok = re.match(r"^((?:\d+/\d+|\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞⅕])(?:\s+(?:\d+/\d+|[½⅓⅔¼¾⅛⅜⅝⅞⅕]))?)(?:\s*(?:-|–|to)\s*[\d½¼¾⅓⅔/]+)?\s*", s)
    if tok:
        total = 0
        for part in tok.group(1).split():
            if "/" in part: a, b = part.split("/"); total += int(a) / int(b) if int(b) else 0
            elif part in FRAC: total += FRAC[part]
            else: total += float(part)
        return round(total, 3), s[tok.end():]
    w = re.match(r"^(one|two|three|four|five|six|a|an|half)\s+", s, re.I)
    if w: return WORDNUM[w.group(1).lower()], s[w.end():]
    return None, s


def parse_ingredient(line):
    s = clean_md(strip_marker(line))
    if not s: return None
    amount, rest = parse_amount(s)
    unit, sz = None, None
    sm = re.match(r"^(large|medium|small|big|heaping|generous|scant)\s+", rest, re.I)
    if sm and amount is not None: sz = sm.group(1).lower(); rest = rest[sm.end():]
    m = re.match(r"^([A-Za-z]+)\.?\s+(?:of\s+)?", rest)
    if m and m.group(1).lower() in UNITS and (amount is not None or m.group(1).lower() in ("pinch", "dash", "handful")):
        unit = UNITS[m.group(1).lower()]; rest = rest[m.end():]
    rest = re.sub(r"^\(([^)]*)\)\s*", lambda m: "", rest) if rest.startswith("(") and amount is not None else rest
    name, prep = rest, None
    if "," in rest: name, prep = [x.strip() for x in rest.split(",", 1)]
    pm = re.search(r"\s*\(([^)]*)\)\s*$", name)
    if pm: name = name[:pm.start()]; prep = ", ".join(x for x in [pm.group(1), prep] if x)
    size = re.match(r"^(large|medium|small|big|fresh|freshly)\s+", name, re.I)
    if size and len(name.split()) > 1: name = name[size.end():]; prep = ", ".join(x for x in [size.group(1).lower(), prep] if x)
    if sz: prep = ", ".join(x for x in [sz, prep] if x)
    name = name.strip(" .;:-")
    if not name: return None
    return {"amount": amount, "unit": unit, "name": name[:1].upper() + name[1:], "prep": prep or None}


def looks_like_subhead(line):
    raw = line.strip()
    t = clean_md(strip_marker(raw))
    if not t: return True
    if raw.startswith("#"): return True
    if re.fullmatch(r"[-*\s]*\*\*[^*]+\*\*\s*:?", raw): return True          # **Produce**
    if t.endswith(":") and len(t) < 40 and not re.search(r"\d", t[:3]): return True   # For the sauce:
    return False


def split_sections(body):
    """→ dict(intro=[lines], ingredients=[lines], steps=[lines], notes=[lines])"""
    out = {"intro": [], "ingredients": [], "steps": [], "notes": []}
    cur = "intro"
    for line in body.split("\n"):
        if re.match(r"^\s*!\[", line): continue
        m = SECTION.match(line)
        if m:
            k = m.group(1).lower()
            cur = "ingredients" if k.startswith("ingredient") else "notes" if k.startswith("note") or k in ("to serve", "for serving") else "steps"
            continue
        out[cur].append(line)
    return out


def paragraphs(lines):
    """Join wrapped lines into items: each bullet / numbered line / blank-separated paragraph is one item."""
    items, buf = [], []
    def flush():
        if buf: items.append(" ".join(buf)); buf.clear()
    for line in lines:
        if not line.strip(): flush(); continue
        if re.match(r"^\s*(?:[-*•]\s+|\d+[.)]\s*|#+\s*)", line): flush(); buf.append(line.strip())
        else: buf.append(line.strip())
    flush()
    return items


def build_steps(lines):
    steps, prefix = [], ""
    for item in paragraphs(lines):
        t = re.sub(r"^step\s*\d+\s*[:.]\s*", "", clean_md(strip_marker(item)), flags=re.I)
        if not t: continue
        # a short heading like "1. Make the sauce:" becomes the start of the next step
        if (looks_like_subhead(item) or (t.endswith(":") and len(t) < 60)) and len(t) < 80:
            prefix = (prefix + " " + re.sub(r"^\d+\s*[.)]\s*", "", t)).strip(); continue
        steps.append((prefix + " " + t).strip() if prefix else t); prefix = ""
    if prefix: steps.append(prefix)
    return steps


def classify_loose(lines):
    """No section markers: bullets that start with an amount are ingredients; other text is steps/notes."""
    ings, rest = [], []
    for item in paragraphs(lines):
        t = clean_md(strip_marker(item))
        if not t: continue
        if re.match(r"^[-*•]\s", item.strip()) and parse_amount(t)[0] is not None and len(t) < 90: ings.append(item)
        else: rest.append(item)
    return ings, rest


def match_grocery(name, candidates):
    if not candidates: return None
    n = name.lower()
    best, score = None, 0
    for c in candidates:
        cn = nice_grocery(c).lower()
        s = difflib.SequenceMatcher(None, n, cn).ratio()
        words = set(re.findall(r"[a-z]+", cn)) - {"oil", "fresh", "of", "the"}
        if words and words <= set(re.findall(r"[a-z]+", n)): s = max(s, .9)
        if cn in n: s = max(s, .85)                       # "olive oil" inside "extra-virgin olive oil"
        elif n in cn: s = min(s, .5)                       # "onion" must not become "Red onion"
        if s > score: best, score = c, s
    return best if score >= .6 else None


def convert(recipe_dir, grocery_csv):
    grocery = {}
    for r in csv.DictReader(open(grocery_csv, encoding="utf-8-sig")):
        name = (r.get("Ingredient") or "").strip()
        if not name: continue
        grocery[name] = {"name": nice_grocery(name), "category": CATEGORY.get((r.get("Type") or "").strip().lower(), "Pantry"),
                         "stock_status": STOCK.get((r.get("In stock") or "").strip().lower(), "not_tracked")}
    recipes, warnings = [], []
    for f in sorted(glob.glob(os.path.join(recipe_dir, "*.md"))):
        title, p, body = parse_props(open(f, encoding="utf-8").read())
        title = clean_md(title)
        if not title: continue
        tags = []
        for key in ("Dish", "Tags", "Thoughts"):
            for t in [x.strip() for x in (p.get(key) or "").split(",") if x.strip()]:
                if t.lower() in SKIP_TAGS: continue
                t = TAG_ALIASES.get(t.lower(), t[:1].upper() + t[1:])
                if t not in tags: tags.append(t)
        if p.get("Try?") == "Yes" and "To try" not in tags: tags.append("To try")
        archived = "hide" in (p.get("Tags") or "").lower()
        src = (p.get("From") or "").strip()
        url = src if re.match(r"^https?://", src) else None
        loc = ", ".join(x.strip() for x in (p.get("Location") or "").split(",") if x.strip())
        source_notes = ", ".join(x for x in [None if url else src, f"p. {loc}" if loc and re.fullmatch(r"[\d, ]+", loc) else loc] if x) or None
        try: minutes = int(float(p.get("Time (min)"))) if p.get("Time (min)") else None
        except ValueError: minutes = None

        sec = split_sections(body)
        ing_lines, step_lines, intro_lines = sec["ingredients"], sec["steps"], sec["intro"]
        if not ing_lines and not step_lines:
            ing_lines, loose = classify_loose(intro_lines)
            intro_lines, step_lines = [], loose
        ingredients = []
        for n, item in enumerate(paragraphs(ing_lines)):
            # numbered lines (or long sentences) inside an ingredient list are really the method
            if re.match(r"^\s*\d+[.)]\s", item) or len(clean_md(item)) > 120:
                step_lines = [item] + step_lines if not step_lines else step_lines + [item]; continue
            if looks_like_subhead(item): continue
            g = parse_ingredient(item)
            if g: ingredients.append(g)
        steps = build_steps(step_lines)
        notes_parts = [clean_md(x) for x in paragraphs(intro_lines) if clean_md(x)] + [clean_md(x) for x in paragraphs(sec["notes"]) if clean_md(x)]

        # link each line to the recipe's grocery items, so stock + category carry over
        linked = rel_names(p.get("Ingredients5"))
        used = set()
        for g in ingredients:
            gm = match_grocery(g["name"], [c for c in linked if c not in used])
            if gm and gm in grocery: g["name"] = grocery[gm]["name"]; used.add(gm)
        # grocery items linked to the recipe but not in the text (or no text at all) → add without amounts
        for c in linked:
            if c not in used and c in grocery and not any(x["name"].lower() == grocery[c]["name"].lower() for x in ingredients):
                ingredients.append({"amount": None, "unit": None, "name": grocery[c]["name"], "prep": None})

        if not ingredients: warnings.append(f"{title}: no ingredients")
        if not steps and not archived: warnings.append(f"{title}: no method")
        recipes.append({"title": title, "servings": DEFAULT_SERVINGS, "total_minutes": minutes, "tags": tags,
                        "ingredients": ingredients, "steps": steps, "notes": "\n\n".join(notes_parts) or None,
                        "source_url": url, "source_notes": source_notes, "archived": archived})
    # de-dup titles (keep the one with more content)
    by = {}
    for r in recipes:
        k = r["title"].lower()
        if k not in by or len(json.dumps(r)) > len(json.dumps(by[k])): by[k] = r
    recipes = sorted(by.values(), key=lambda r: r["title"].lower())
    pantry = sorted({g["name"].lower(): g for g in grocery.values()}.values(), key=lambda g: g["name"].lower())
    return {"format": "kitchen-import-v1", "source": "notion", "generated": datetime.date.today().isoformat(),
            "recipes": recipes, "pantry": pantry, "warnings": warnings}


if __name__ == "__main__":
    data = convert(sys.argv[1], sys.argv[2])
    json.dump(data, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(data["recipes"]), "recipes,", len(data["pantry"]), "pantry items,", len(data["warnings"]), "warnings")
