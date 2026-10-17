// Ingredient names → "just the thing". Used by Pantry → Tidy up to suggest merges
// ("Lemons", "Lemon zest", "Juice of ½ lemon" → Lemon). Suggestions only — you approve every merge.

// Words that describe how it's prepared or bought, not what it is. They move to the recipe line's prep.
const DESCRIBE = new Set(("fresh freshly finely roughly coarsely thinly chopped minced sliced diced grated cracked squeezed melted " +
  "large small medium big ripe very good store-bought homemade packed peeled softened room temperature juice juiced zest zested " +
  "peel wedges wedge clove cloves stalk stalks leaves leaf sprig sprigs handful splash pinch whole-milk extra-virgin extra virgin " +
  "kosher fine coarse sea table optional divided halved quartered trimmed rinsed drained cold warm hot").split(" "));
const FILLER = new Set("of the a an from in to for some about plus".split(" "));
// Different words, same thing to buy.
const SAME = [
  [/^parmigiano[ -]reggiano$|^parmesan cheese$|^parm$/, "parmesan"],
  [/^(green onion|spring onion)$/, "scallion"],
  [/^(yellow|white|sweet|white or yellow|yellow or white) onion$/, "onion"],
  [/^(black peppercorn|ground black pepper|ground pepper|pepper|peppercorn)$/, "black pepper"],
  [/^(crushed red pepper|red-pepper flake|red pepper flake|chili flake|chile flake)$/, "red pepper flakes"],
  [/^(evoo|olive oil olive oil)$/, "olive oil"],
  [/^(neutral oil|canola or vegetable oil)$/, "vegetable oil"],
  [/^(cilantro leaf|fresh cilantro)$/, "cilantro"],
];
// Plural words that aren't plurals (or shouldn't be made singular).
const KEEP_S = new Set("asparagus hummus couscous molasses swiss brussels greens oats flakes grits sprouts chips crumbs breadcrumbs noodles lentils chickpeas peas beans capers pickles fries herbes".split(" "));

function singular(w) {
  if (KEEP_S.has(w) || w.length < 4) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";                    // berries → berry
  if (/(tomato|potato)es$/.test(w)) return w.slice(0, -2);            // tomatoes → tomato
  if (/(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);               // radishes → radish
  if (/[^s]s$/.test(w)) return w.slice(0, -1);                        // lemons → lemon
  return w;
}

// → { base: "lemon", extra: ["zest"] }  or null when the name is a combo ("salt and pepper") or a note.
export function baseName(name) {
  let s = String(name || "").toLowerCase()
    .replace(/~~|\*|“|”|"/g, " ")
    .replace(/\([^)]*\)?/g, " ")                 // (anything) and a dangling "(or more"
    .split(",")[0]
    .replace(/\b(to taste|for serving|as needed|for frying|for cooking|for garnish|to serve|if desired)\b.*$/, "")
    .replace(/\s+plus\s.*$/, "")
    .replace(/^\s*[+~]+/, " ")
    .replace(/[\d½⅓⅔¼¾⅛/.-]+(?=\s|$)/g, " ")     // amounts
    .replace(/\b(can|cans|jar|tbsp|tsp|cup|cups|oz|lb|g|tablespoons?|teaspoons?)\b/g, " ");
  if (/\b(and|&)\b/.test(s) || /\?/.test(s)) return null;           // combos and notes stay as they are
  s = s.replace(/\s+or\s.*$/, "");                                  // "red onion or shallot" → red onion
  const words = s.split(/\s+/).filter(Boolean);
  const extra = [], keep = [];
  words.forEach((w, i) => {
    if (FILLER.has(w)) return;
    if (w === "ground" && !/^(black|white|pepper)$/.test(words[i + 1] || "")) { keep.push(w); return; }  // ground lamb stays
    if (DESCRIBE.has(w) || w === "ground") { extra.push(w); return; }
    keep.push(w);
  });
  if (!keep.length) return null;
  keep[keep.length - 1] = singular(keep[keep.length - 1]);
  let base = keep.join(" ");
  for (const [re, to] of SAME) if (re.test(base)) { base = to; break; }
  return { base, extra: extra.filter(w => !/^(extra|virgin|extra-virgin|kosher|fine|coarse|sea|table|good|very|clove|cloves|stalk|stalks|leaves|leaf|sprig|sprigs|whole-milk)$/.test(w)) };
}

export const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);

// pantry: [{ ingredient_id, name, uses }] → [{ base, name, members:[item] }] for every base with 2+ names
export function suggestGroups(pantry) {
  const by = new Map();
  for (const it of pantry) {
    const b = baseName(it.name); if (!b) continue;
    if (!by.has(b.base)) by.set(b.base, []);
    by.get(b.base).push(it);
  }
  return [...by].filter(([, m]) => m.length > 1)
    .map(([base, members]) => ({ base, name: titleCase(base), members: members.sort((a, b) => (b.uses || 0) - (a.uses || 0)) }))
    .sort((a, b) => a.base.localeCompare(b.base));
}

// What a recipe line keeps when "Lemon zest" becomes "Lemon": "zest" (joined onto its prep, no repeats).
export function mergedPrep(fromName, prep) {
  const b = baseName(fromName); const extra = b ? b.extra : [];
  const have = String(prep || "").toLowerCase();
  const add = extra.filter(w => !have.includes(w));
  return [add.join(" "), prep].filter(Boolean).join(", ") || null;
}
