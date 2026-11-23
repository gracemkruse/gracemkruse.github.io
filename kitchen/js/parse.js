// "1 ½ cups all-purpose flour, sifted" → { amount: 1.5, unit: "cup", name: "All-purpose flour", prep: "sifted" }
// Same rules as tools/notion_to_kitchen.py, so imported and linked recipes read alike.
const UNITS = {
  tablespoons: "tbsp", tablespoon: "tbsp", tbsp: "tbsp", tbs: "tbsp", tbsps: "tbsp",
  teaspoons: "tsp", teaspoon: "tsp", tsp: "tsp", tsps: "tsp",
  cups: "cup", cup: "cup", c: "cup", pounds: "lb", pound: "lb", lbs: "lb", lb: "lb",
  ounces: "oz", ounce: "oz", oz: "oz", grams: "g", gram: "g", g: "g", kilograms: "kg", kg: "kg",
  milliliters: "ml", ml: "ml", liters: "l", liter: "l", l: "l",
  cloves: "clove", clove: "clove", cans: "can", can: "can", jar: "jar", jars: "jar",
  packages: "package", package: "package", pkg: "package", bunches: "bunch", bunch: "bunch",
  sprigs: "sprig", sprig: "sprig", pinch: "pinch", pinches: "pinch", slices: "slice", slice: "slice",
  stalks: "stalk", stalk: "stalk", heads: "head", head: "head", sticks: "stick", stick: "stick",
  quarts: "quart", quart: "quart", pints: "pint", pint: "pint", handful: "handful", handfuls: "handful", dash: "dash", dashes: "dash",
  containers: "container", container: "container", pieces: "piece", piece: "piece", bottles: "bottle", bottle: "bottle",
  bags: "bag", bag: "bag", boxes: "box", box: "box", tins: "tin", tin: "tin", cartons: "carton", carton: "carton", tubes: "tube", tube: "tube",
};
// Prep written in front of the ingredient ("packed basil", "finely chopped dill", "thinly sliced onion") moves to prep.
// Words that are part of what you buy stay in the name: ground cumin, toasted sesame oil, crushed tomatoes, dried oregano.
// Containers keep their size, because cans and jars come in different sizes: "1 (15-oz) can" → unit "(15 oz) can".
const CONTAINERS = new Set(["can", "jar", "package", "container", "bag", "box", "bottle", "tin", "carton", "tube"]);
const sizeOf = t => (t = t.replace(/(\d)([a-z])/gi, "$1 $2"), /\d/.test(t) && /\b(oz|ounces?|g|grams?|kg|ml|l|liters?|lbs?|pounds?|fl)\b/i.test(t.replace(/-/g, " ")))
  ? t.replace(/([\d½⅓⅔¼¾⅛])\s*-\s*(?=[a-z])/gi, "$1 ").replace(/\bounces?\b/gi, "oz").replace(/\bgrams?\b/gi, "g").replace(/\bpounds?\b/gi, "lb").replace(/\s+/g, " ").trim() : null;
const PREP_FRONT = /^((?:(?:tightly|loosely|lightly|firmly|well|finely|roughly|coarsely|thinly|freshly|very)\s+)?(?:packed|chopped|minced|diced|sliced|grated|shredded|crumbled|squeezed|torn|softened|melted|peeled|halved|quartered|cubed|julienned)(?:\s+(?:and|or)\s+(?:chopped|minced|diced|sliced|grated|shredded|crumbled|torn|peeled|halved|quartered|cubed))?),?\s+/i;
const FRAC = { "½": .5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": .25, "¾": .75, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875, "⅕": .2 };
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1, half: .5 };
const F = "½⅓⅔¼¾⅛⅜⅝⅞⅕";

function parseAmount(s) {
  s = s.trim().replace(new RegExp(`(\\d)([${F}])`, "g"), "$1 $2");
  const tok = s.match(new RegExp(`^((?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[${F}])(?:\\s+(?:\\d+\\/\\d+|[${F}]))?)(?:\\s*(?:-|–|to)\\s*[\\d${F}/.]+)?\\s*`));
  if (tok) {
    let total = 0;
    for (const p of tok[1].split(/\s+/)) {
      if (p.includes("/")) { const [a, b] = p.split("/").map(Number); total += b ? a / b : 0; }
      else total += FRAC[p] ?? Number(p);
    }
    return [Math.round(total * 1000) / 1000, s.slice(tok[0].length)];
  }
  const w = s.match(/^(one|two|three|four|five|six|a|an|half)\s+/i);
  if (w) return [WORDNUM[w[1].toLowerCase()], s.slice(w[0].length)];
  return [null, s];
}

export function parseIngredient(line) {
  let s = String(line || "").replace(/&frac12;/g, "½").replace(/&frac14;/g, "¼").replace(/&frac34;/g, "¾").replace(/&frac13;/g, "⅓").replace(/&frac23;/g, "⅔")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").replace(/\*\*|~~/g, "").replace(/^\s*(?:[-*•▢□☐]\s*|\[[ xX]?\]\s*)/, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let [amount, rest] = parseAmount(s), unit = null, size = null;
  const front = [];                                                                       // prep found in front of the name
  const sizeWord = () => { const sm = rest.match(/^(large|medium|small|big|heaping|generous|scant|medium-sized|large-sized|small-sized)\s+/i);
    if (sm) { size = sm[1].toLowerCase(); rest = rest.slice(sm[0].length); } };
  if (amount != null) sizeWord();
  let paren = null;                                                                       // "1 (15-oz) can beans"
  if (amount != null && rest.startsWith("(")) { const pm0 = rest.match(/^\(([^)]*)\)\s*/); paren = pm0[1].trim(); rest = rest.slice(pm0[0].length); }
  const pf = rest.match(/^(packed|heaping|level|loosely packed|tightly packed)\s+(?=[A-Za-z]+\.?\s)/i);   // "½ packed cup dill"
  if (pf && amount != null && UNITS[rest.slice(pf[0].length).match(/^([A-Za-z]+)/)?.[1].toLowerCase()]) { front.push(pf[1].toLowerCase()); rest = rest.slice(pf[0].length); }
  // "½ cup/115 grams butter" (NYT style): the cup is the unit, the weight goes to prep
  const metric = rest.match(/^([A-Za-z]+)\.?\s*\/\s*([\d.½¼¾⅓⅔]+\s*(?:grams?|g|kilograms?|kg|ounces?|oz|ml|milliliters?|pounds?|lbs?))\.?\s+/i);
  if (metric && UNITS[metric[1].toLowerCase()] && amount != null) { rest = `${metric[1]} ${rest.slice(metric[0].length)}`; front.push(metric[2].replace(/\bounces?\b/i, "oz").replace(/\bgrams?\b/i, "grams")); }
  const m = rest.match(/^([A-Za-z]+)\.?\s+(?:of\s+)?/);
  if (m && UNITS[m[1].toLowerCase()] && (amount != null || /^(pinch|dash|handful)$/i.test(m[1]))) { unit = UNITS[m[1].toLowerCase()]; rest = rest.slice(m[0].length); }
  if (amount != null && unit && rest.startsWith("(")) { const pm1 = rest.match(/^\(([^)]*)\)\s*/); paren = paren || pm1[1].trim(); rest = rest.slice(pm1[0].length); }   // "1 can (15 oz) beans"
  if (paren) { const size = sizeOf(paren);
    if (size && unit && CONTAINERS.has(unit)) unit = `(${size}) ${unit}`;
    else front.push(paren); }                                                             // anything else in brackets goes to prep
  if (!size) sizeWord();
  const fp = rest.match(PREP_FRONT);
  if (fp && rest.slice(fp[0].length).trim()) { front.push(fp[1].toLowerCase()); rest = rest.slice(fp[0].length); }
  let extra = null;                                                                       // "1½ cups plus 1 Tbsp. (200 g) flour"
  const plus = rest.match(/^plus\s+[\d½⅓⅔¼¾⅛/ .]+\s*[A-Za-z]+\.?\s*(?:\([^)]*\)\s*)?/i);
  if (plus) { extra = plus[0].trim(); rest = rest.slice(plus[0].length); }
  let name = rest, prep = null;
  let depth = 0, comma = -1;                                                              // first comma outside (…)
  for (let i = 0; i < rest.length; i++) { const c = rest[i]; if (c === "(") depth++; else if (c === ")") depth--; else if (c === "," && depth <= 0) { comma = i; break; } }
  if (comma > 0) { name = rest.slice(0, comma); prep = rest.slice(comma + 1).trim(); }
  if (extra) prep = [extra, prep].filter(Boolean).join(", ");
  const pm = name.match(/\s*\(([^)]*)\)\s*$/); if (pm) { name = name.slice(0, pm.index); prep = [pm[1], prep].filter(Boolean).join(", "); }
  if (front.length) prep = [front.join(", "), prep].filter(Boolean).join(", ");
  if (size) prep = [size, prep].filter(Boolean).join(", ");
  name = name.replace(/^[\s.;:-]+|[\s.;:-]+$/g, "");
  if (!name) return null;
  return { amount, unit, name: name[0].toUpperCase() + name.slice(1), prep: prep || null };
}

// A whole recipe pasted as text (B-38) → { title, ingredients: [lines], steps: [lines] }.
// Uses headings when there are any ("Ingredients", "Method", "Directions"…); otherwise lines that start with an
// amount are ingredients and the rest is the method. A short first line that isn't an ingredient is the title.
export function parseRecipeText(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const head = l => l.replace(/[:#*_]/g, "").trim().toLowerCase();
  const ING = /^(ingredients?|you(’|')ll need|what you(’|')ll need|shopping list)$/;
  const METHOD = /^(method|directions|instructions|steps|preparation|how to make( it)?)$/;
  const isIng = l => /^[-•*▢□]?\s*(\d|[½⅓⅔¼¾⅛]|a |an |pinch|handful|salt|pepper)/i.test(l) && l.length < 90;
  let mode = null, headings = false, title = "";
  const ingredients = [], steps = [];
  for (const l of lines) {
    const h = head(l);
    if (ING.test(h)) { mode = "ing"; headings = true; continue; }
    if (METHOD.test(h)) { mode = "method"; headings = true; continue; }
    if (!mode) {
      if (!title && !isIng(l) && l.length < 80) { title = l; continue; }
      mode = isIng(l) ? "ing" : "method";
    }
    // no headings: once a long line that isn't an ingredient shows up, the method has started
    if (mode === "ing" && !headings && !isIng(l) && l.length > 60) mode = "method";
    if (mode === "ing") ingredients.push(l);
    else steps.push(l.replace(/^(step\s*)?\d+[.)]\s*/i, ""));
  }
  return { title, ingredients, steps };
}
