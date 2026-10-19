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
  quarts: "quart", quart: "quart", pints: "pint", pint: "pint", handful: "handful", dash: "dash",
};
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
  let s = String(line || "").replace(/<[^>]+>/g, "").replace(/\*\*|~~/g, "").replace(/^\s*(?:[-*•▢□☐]\s*|\[[ xX]?\]\s*)/, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let [amount, rest] = parseAmount(s), unit = null, size = null;
  const sm = rest.match(/^(large|medium|small|big|heaping|generous|scant)\s+/i);
  if (sm && amount != null) { size = sm[1].toLowerCase(); rest = rest.slice(sm[0].length); }
  const m = rest.match(/^([A-Za-z]+)\.?\s+(?:of\s+)?/);
  if (m && UNITS[m[1].toLowerCase()] && (amount != null || /^(pinch|dash|handful)$/i.test(m[1]))) { unit = UNITS[m[1].toLowerCase()]; rest = rest.slice(m[0].length); }
  if (amount != null && rest.startsWith("(")) rest = rest.replace(/^\([^)]*\)\s*/, "");   // "2 (14-oz) cans" → keep it simple
  let extra = null;                                                                       // "1½ cups plus 1 Tbsp. (200 g) flour"
  const plus = rest.match(/^plus\s+[\d½⅓⅔¼¾⅛/ .]+\s*[A-Za-z]+\.?\s*(?:\([^)]*\)\s*)?/i);
  if (plus) { extra = plus[0].trim(); rest = rest.slice(plus[0].length); }
  let name = rest, prep = null;
  let depth = 0, comma = -1;                                                              // first comma outside (…)
  for (let i = 0; i < rest.length; i++) { const c = rest[i]; if (c === "(") depth++; else if (c === ")") depth--; else if (c === "," && depth <= 0) { comma = i; break; } }
  if (comma > 0) { name = rest.slice(0, comma); prep = rest.slice(comma + 1).trim(); }
  if (extra) prep = [extra, prep].filter(Boolean).join(", ");
  const pm = name.match(/\s*\(([^)]*)\)\s*$/); if (pm) { name = name.slice(0, pm.index); prep = [pm[1], prep].filter(Boolean).join(", "); }
  if (size) prep = [size, prep].filter(Boolean).join(", ");
  name = name.replace(/^[\s.;:-]+|[\s.;:-]+$/g, "");
  if (!name) return null;
  return { amount, unit, name: name[0].toUpperCase() + name.slice(1), prep: prep || null };
}
