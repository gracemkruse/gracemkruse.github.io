// Geometric icon set, exported from the Figma style guide ("04 Style Guide" → Icon/*, Icon/ingredient/*).
// 20-unit grid, 1px non-scaling line, at most one small solid per icon. icon(name) = 20px, icon(name, true) = 16px inline.
// To update: export the component as SVG in Figma and paste its <path>s here (stroke → line, fill → solid).
import { INGREDIENT_PATHS } from "./ingredient-icons.js";
const L = d => `<path d="${d}"/>`;                                   // line
const D = d => `<path d="${d}" stroke-dasharray="2 2"/>`;            // dashed line
const S = d => `<path d="${d}" fill="currentColor" stroke="none"/>`; // small solid
const BOWL = "M3 11H16.3333C16.3333 12.7681 15.631 14.4638 14.3807 15.714C13.1305 16.9643 11.4348 17.6667 9.66667 17.6667C7.89856 17.6667 6.20286 16.9643 4.95262 15.714C3.70238 14.4638 3 12.7681 3 11Z";
const RING = "M9.66667 16.3333C13.3486 16.3333 16.3333 13.3486 16.3333 9.66667C16.3333 5.98477 13.3486 3 9.66667 3C5.98477 3 3 5.98477 3 9.66667C3 13.3486 5.98477 16.3333 9.66667 16.3333Z";
const DOT = "M9.83333 10.6667C10.2936 10.6667 10.6667 10.2936 10.6667 9.83333C10.6667 9.3731 10.2936 9 9.83333 9C9.3731 9 9 9.3731 9 9.83333C9 10.2936 9.3731 10.6667 9.83333 10.6667Z";
const LEAF = L("M10.4446 3C14.6112 6.33333 15.4446 10.5 10.4446 18C5.44457 10.5 6.27791 6.33333 10.4446 3Z") + D("M10 6V17.6667") + S("M9.83333 18.6667C10.2936 18.6667 10.6667 18.2936 10.6667 17.8333C10.6667 17.3731 10.2936 17 9.83333 17C9.3731 17 9 17.3731 9 17.8333C9 18.2936 9.3731 18.6667 9.83333 18.6667Z");
const dot = (cx, cy) => `M${cx} ${cy + 0.8333}C${cx + 0.4603} ${cy + 0.8333} ${cx + 0.8333} ${cy + 0.4602} ${cx + 0.8333} ${cy}C${cx + 0.8333} ${cy - 0.4602} ${cx + 0.4603} ${cy - 0.8333} ${cx} ${cy - 0.8333}C${cx - 0.4602} ${cy - 0.8333} ${cx - 0.8333} ${cy - 0.4602} ${cx - 0.8333} ${cy}C${cx - 0.8333} ${cy + 0.4602} ${cx - 0.4602} ${cy + 0.8333} ${cx} ${cy + 0.8333}Z`;
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const PATHS = {
  // categories
  produce: LEAF,
  protein: L("M3 11.6667C3 9.89856 3.70238 8.20286 4.95262 6.95262C6.20286 5.70238 7.89856 5 9.66667 5C11.4348 5 13.1305 5.70238 14.3807 6.95262C15.631 8.20286 16.3333 9.89856 16.3333 11.6667H3Z") + D("M3 15H16.3333") + S(dot(9.8333, 8.8333)),
  dairy: L("M10 3L15 10.5C15 11.8261 14.4732 13.0979 13.5355 14.0355C12.5979 14.9732 11.3261 15.5 10 15.5C8.67392 15.5 7.40215 14.9732 6.46447 14.0355C5.52678 13.0979 5 11.8261 5 10.5L10 3Z") + D("M7 13H13.6667"),
  pantry: L("M3 16.3333V13H6.33333V9.66667H9.66667V6.33333H13V3H16.3333V16.3333H3Z") + L("M17 13.6667H7V17M17 10.3333H10.3333V17M17 7H13.6667V17"),
  herbs: L(RING) + L("M10.3333 6V14.3333M7 8.08333L13.6667 12.25M13.6667 8.08333L7 12.25"),
  household: D("M16.3333 3H3V16.3333H16.3333V3Z") + S("M17 3H12V8H17V3Z"),
  // recipe tags
  soup: L(BOWL) + L("M10 8V3M6.66667 8L5 4.66667M13.3333 8L15 4.66667"),
  pasta: L(BOWL) + D("M6 8.48113C6.83333 6.81446 7.66667 10.1478 8.5 8.48113C9.33333 6.81446 10.1667 10.1478 11 8.48113C11.8333 6.81446 12.6667 10.1478 13.5 8.48113"),
  baking: L("M10 18V8") + S(circ(9.6667, 4.6667, 1.6667)) + L("M7 8L10.3333 10.5L13.6667 8M7 11.3333L10.3333 13.8333L13.6667 11.3333"),
  quick: L("M10.8333 3L5 11.3333H10L9.16667 18L15 9.66667H10L10.8333 3Z"),
  veg: LEAF,
  // facts
  time: L(RING) + L("M10 6V10.1667L12.5 11.8333") + S(DOT),
  serves: L(RING) + D(circ(10.3333, 10.3333, 3.3333)) + S(DOT),
  made: L("M3 9.66667C2.99819 11.2015 3.52605 12.69 4.49447 13.8808C5.46289 15.0717 6.81254 15.8918 8.31557 16.2029C9.8186 16.514 11.3829 16.2969 12.7444 15.5883C14.106 14.8797 15.1813 13.7229 15.7888 12.3134C16.3964 10.9039 16.499 9.32793 16.0792 7.85155C15.6595 6.37517 14.7432 5.08884 13.485 4.20973C12.2269 3.33061 10.7039 2.91258 9.1732 3.02619C7.64253 3.1398 6.19795 3.7781 5.08334 4.83333M3 3V6.33333H6.33334") + S(DOT),
  source: L("M10 6C8.3333 4.6667 5.6667 4.3333 3 5V15.6667C5.6667 15 8.3333 15.3333 10 16.6667C11.6667 15.3333 14.3333 15 17 15.6667V5C14.3333 4.3333 11.6667 4.6667 10 6Z") + D("M10 6V16.6667"),   // open book
  link: L("M6 14.3333L14.3333 6M14.3333 12.6667V6H7.66667"),
  // interface
  search: L(circ(9, 9, 5)) + L("M16.75 16.75L13 13"),
  plus: L("M9.83333 4V15.6667M4 9.83333H15.6667"),
  check: L("M5 10.1667L8.33333 13.5L15 6"),
  ring: L(circ(10, 10, 5.5)),   // not done yet (Cooked today before it's tapped)
  back: L("M13 5L8 10L13 15"),
  open: L("M8 5L13 10L8 15"),
  down: L("M5 8L10 13L15 8"),
  play: L("M7 4L16.1667 9.83333L7 15.6667V4Z"),
  sync: L("M3 10.5C2.99856 9.14525 3.4099 7.82222 4.17922 6.7071C4.94854 5.59199 6.03934 4.73772 7.30633 4.25807C8.57333 3.77842 9.95639 3.69616 11.2713 4.02224C12.5862 4.34833 13.7706 5.06727 14.6667 6.08333M16.3333 10.5C16.3348 11.8547 15.9234 13.1778 15.1541 14.2929C14.3848 15.408 13.294 16.2623 12.027 16.7419C10.76 17.2216 9.37696 17.3038 8.06204 16.9778C6.74712 16.6517 5.56275 15.9327 4.66667 14.9167M14.6667 3V6.33333H11.3333M4.66667 18V14.6667H8"),
  close: L("M5 5L15 15M15 5L5 15"),   // not in Figma yet: same 1px line style
  // ingredients: see ingredient-icons.js (added below)
};

export function icon(name, inline = false, extraClass = "") {
  const d = PATHS[name];
  if (!d) return "";
  return `<svg class="icon${inline ? " inline" : ""}${extraClass ? " " + extraClass : ""}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.replace(/<(path|circle|rect)/g, '<$1 vector-effect="non-scaling-stroke"')}</svg>`;
}

// Map a recipe's tags to the icon shown next to its meta line.
const TAG_ICON = { soup: "soup", pasta: "pasta", baking: "baking", bread: "baking", weeknight: "quick", quick: "quick", vegetarian: "veg", veg: "veg", salad: "produce" };
export function tagIcon(tags = []) {
  for (const t of tags) { const k = TAG_ICON[String(t).toLowerCase()]; if (k) return k; }
  return null;
}

// View-switch glyphs (1 / 2 / 4 per row), drawn as simple outlined/filled blocks.
export function densityGlyph(n, active) {
  const fill = active ? 'fill="currentColor"' : 'fill="none"';
  const r = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fill} stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  const shapes = n === 1 ? r(4.5, 2.5, 11, 15) : n === 2 ? r(3.5, 2.5, 5, 15) + r(11.5, 2.5, 5, 15) : r(3.5, 2.5, 5, 6) + r(11.5, 2.5, 5, 6) + r(3.5, 11.5, 5, 6) + r(11.5, 11.5, 5, 6);
  return `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${shapes}</svg>`;
}

Object.assign(PATHS, INGREDIENT_PATHS);

// Ingredient icon for a shopping row: the food's own drawing, otherwise its category icon.
// One icon per food, not per variety. Order matters: the more specific phrase wins
// ("garlic powder" is a spice jar, "chicken stock" is stock, "peanut butter" is a jar).
const ING_ICON = [
  // household
  ["towels", /\b(paper towels?|towels?|toilet paper|tin foil|foil|cling wrap|parchment)\b/],
  ["soap", /\b(soap|detergent|bleach|scrub bubbles|clorox|tide|mop|cleaner)\b/],
  ["sponge", /\bsponges?\b/], ["bag", /\b(bags?|containers?)\b/], ["medicine", /\b(benadryl|nyquil|vitamins?|medicine)\b/],
  ["tube", /\b(toothpaste|tomato paste|anchovy paste|harissa)\b/],
  // drinks, vinegars and sauces before the foods they're made from
  ["vinegar", /\b(vinegar|vinaigrette)\b/], ["fish", /\b(anchov(y|ies)|tuna)\b/], ["peas", /\bsugar snap\b/],
  ["seeds", /\bmustard seeds?\b/], ["spice-jar", /\bground mustard\b/], ["chocolate", /\b(chocolate|cocoa|coco powder)\b/], ["tea", /\bmatcha\b/], ["coffee", /\b(coffee|espresso)\b(?! powder)/], ["beer", /\b(beer|lager|hard cider)\b/],
  ["spirits", /\b(vodka|gin|tequila|bourbon|brandy|liqueur|kahl[uú]a|triple sec|kirsch|rum|whiskey)\b/],
  ["wine", /\b(wine|sherry|vermouth|prosecco|cava|rioja|sake)\b/],
  ["soy-sauce", /\b(soy sauce|fish sauce|oyster sauce|worcestershire|tamari|seasoning sauce)\b/],
  ["hot-sauce", /\b(hot sauce|chili sauce|chili crunch|chili oil|sambal|sriracha|prik nam)\b/],
  ["oil", /\b(oil|cooking spray)\b/],
  ["ice-cream", /\b(ice cream|whipped cream)\b/],
  ["jar", /\b(jam|peanut butter|almond butter|apple butter|nut butter|tahini|miso|pesto|mayo(nnaise)?|aioli|mustard|dijon|kimchi|pickles?|hummus|tzatziki|chutney|skhug)\b/],
  ["honey", /\b(honey|agave|maple syrup|corn syrup)\b/],
  ["tin", /\b(baking powder|baking power|baking soda|yeast|corn ?starch|espresso powder|matzo meal)\b/],
  // spices before the plants they come from
  ["salt", /\bsalt\b/], ["flakes", /\b(chil[ei] flakes|pepper flakes|aleppo)\b/],
  ["seeds", /\b(seeds?|pepitas|sesame)\b/], ["cinnamon", /\bcinnamon sticks?\b/],
  ["spice-jar", /\b(ground(?! (beef|pork|lamb|chicken|turkey|veal))|powder|cumin|nutmeg|turmeric|tumeric|garam masala|za.?atar|cayenne|allspice|cardamom|ras el hanout|sumac|saffron|whole cloves|seasoning|spices?|jeera|cinnamon)\b/],
  ["pepper", /(\b(black|white|cracked|sichuan|ground) pepper\b|\bpepper ?corns?\b|^pepper$)/],
  ["paprika", /\bpaprika\b/], ["vanilla", /\b(vanilla|rosewater|extract|elderflower)\b/], ["bay-leaf", /\bbay lea(f|ves)\b/],
  // pasta, grains, breads
  ["spaghetti", /\b(spaghetti|bucatini|noodles|ramen|linguine|fettuccine|pappardelle|tagliatelle|angel hair|lasagn[ae])\b/],
  ["rigatoni", /\b(rigatoni|paccheri|orecchiette|pasta|shells|orzo|gnocchi|tortellini|fregola|ravioli|ditalini|penne|fusilli|farfalle|macaroni|ziti|conchiglie|campanelle|mezzi)\b/],
  ["flour", /\b(flour|cornmeal|semolina)\b/],
  ["rice", /\b(rice|basmati|quinoa|farro|barley|couscous|oats|oatmeal|granola|cereal|buckwheat)\b/],
  ["tortilla", /\b(tortillas?|pita|flatbreads?|tortilla chips|wraps)\b/],
  ["dough", /\b(dough|puff pastry|phyllo|pie crust|crust)\b/],
  ["bread", /\b(bread|baguette|sourdough|brioche|buns|muffins|croissant|crumbs|panko|toast|croutons)\b/],
  ["cracker", /\bcrackers?\b/], ["chocolate", /\b(chocolate|cocoa|coco powder)\b/],
  ["sugar", /\bsugar\b/],
  // dairy
  ["grater", /\b(parmesan|parmigiano|pecorino|grana padano|piave)\b/], ["mozzarella", /\b(mozzarella|burrata)\b/],
  ["goat-cheese", /\bgoats? cheese\b/],
  ["yogurt", /\b(yogh?urt|sour cream|cr[eè]me fra[iî]che|labneh|ricotta|cream cheese|mascarpone|marscapone)\b/],
  ["coconut", /\bcoconut\b/],
  ["milk", /\b(milk|buttermilk|cream|half.and.half|creamer)\b/], ["butter", /\bbutter\b/],
  ["feta", /\b(feta|cheddar|gruy[eè]re|brie|halloumi|cotija|vacherin|cheese)\b/],
  // protein (stock before chicken; egg noodles caught above)
  ["stock", /\b(stock|broth|dashi)\b/],
  ["ground-meat", /\bground (beef|pork|lamb|chicken|turkey|veal)\b/],
  ["bacon", /\b(bacon|pancetta|guanciale)\b/], ["sausage", /\b(sausage|chorizo)\b/],
  ["salami", /\b(salami|prosciutto|proscuitto|mortadella|ham|lunch meat)\b/],
  ["chicken", /\b(chicken|turkey)\b/], ["egg", /\beggs?\b/],
  ["shrimp", /\bshrimp\b/], ["shellfish", /\b(clams?|manilas|scallops?|mussels)\b/],
  ["fish", /\b(salmon|cod|snapper|swordfish|tuna|anchov(y|ies)|fish)\b/],
  ["pork", /\bpork\b/], ["steak", /\b(steak|ribeye|short ribs|lamb|beef|veal)\b/], ["tofu", /\btofu\b/],
  // produce
  ["greens", /\bbeet greens\b/], ["green-beans", /\bgreen beans\b/], ["beans", /\b(beans|chickpeas|garbanzo|lentils|black.eyed peas)\b/],
  ["date", /\b(dates?|raisins?|craisins|dried cranberries)\b/],
  ["lemon", /\b(lemons?|limes?|zest)\b/],
  ["orange", /\b(oranges?|tangerines?|grapefruit|clementines?)\b/],
  ["apple", /\bapples?\b/], ["pear", /\bpears?\b/], ["banana", /\bbananas?\b/],
  ["strawberry", /\bstrawberr(y|ies)\b/], ["berries", /\b(blueberr(y|ies)|raspberr(y|ies)|cranberr(y|ies)|berries)\b/],
  ["grapes", /\bgrapes\b/], ["peach", /\b(peach(es)?|nectarines?)\b/], ["pineapple", /\bpineapple\b/],
  ["mango", /\bmangos?\b/], ["kiwi", /\bkiwi\b/], ["watermelon", /\bwatermelon\b(?! radish)/], ["fig", /\bfigs?\b/],
  ["persimmon", /\bpersimmons?\b/], ["avocado", /\bavocados?\b/], ["olive", /\b(olives?|capers)\b/],
  ["garlic", /\bgarlic\b/], ["onion", /\b(onions?|shallots?)\b/],
  ["leek", /\b(leeks?|scallions?|chives?|green onions?|spring onions?)\b/],
  ["tomato", /\b(tomato(es)?|tomatillos?|san marzano)\b/],
  ["sweet-potato", /\b(sweet potato(es)?|yams?)\b/], ["potato", /\bpotato(es)?\b/],
  ["carrot", /\b(carrots?|parsnips?)\b/], ["beet", /\b(beets?|beetroot)\b/], ["radish", /\b(radish(es)?|turnips?)\b/],
  ["celery", /\bcelery\b/], ["cucumber", /\b(cucumbers?|cucamelon)\b/], ["zucchini", /\b(zucchini|yellow squash|courgettes?)\b/],
  ["squash", /\b(squash|pumpkin|butternut|delicata|acorn)\b/], ["eggplant", /\beggplants?\b/],
  ["chile", /\b(jalape[nñ]os?|serrano|fresno|chil(e|es|i|ies|lies|les)|calabrian)\b/],
  ["bell-pepper", /\b(bell pepper|sweet peppers?|red peppers?|peppers)\b/],
  ["mushroom", /\b(mushrooms?|shiitake)\b/], ["corn", /\b(corn|popcorn|kettlecorn)\b/],
  ["peas", /\b(peas|edamame)\b/], ["fennel", /\bfennel\b/], ["asparagus", /\basparagus\b/],
  ["broccoli", /\b(broccoli|broccolini|gai lan|rabe)\b/], ["cauliflower", /\bcauliflower\b/],
  ["brussels-sprouts", /\bbrussels?\b/], ["cabbage", /\bcabbage\b/],
  ["lettuce", /\b(lettuce|romaine|mixed greens|arugula|rocket|escarole|radicchio)\b/],
  ["greens", /\b(kale|spinach|chard|collard|beet greens|microgreens|pea shoots?|greens)\b/],
  ["ginger", /\bginger\b/], ["artichoke", /\bartichokes?\b/],
  // herbs
  ["parsley", /\b(parsley|cilantro|coriander)\b/], ["dill", /\bdill\b/],
  ["rosemary", /\b(rosemary|thyme|oregano|tarragon)\b/], ["basil", /\b(basil|mint|sage|marjoram)\b/],
  ["nuts", /\b(almonds?|walnuts?|pecans?|pistachios?|cashews?|peanuts?|pine nuts|nuts|hazelnuts?)\b/],
  ["coffee", /\b(coffee|espresso)\b/], ["tea", /\b(tea|matcha)\b/],
  ["glass", /\b(water|ice|seltzer|juice|tonic|club soda|limeade|cider)\b/],
];
const CAT_ICON = { "produce": "produce", "protein": "protein", "dairy": "dairy", "pantry": "pantry", "herbs & spices": "herbs", "household": "household" };
export function catIcon(category) { return CAT_ICON[String(category || "").toLowerCase()] || "pantry"; }
export function ingredientIcon(name, category) {
  const n = String(name || "").toLowerCase().replace(/[’']/g, "'");
  for (const [k, re] of ING_ICON) if (re.test(n)) return k;
  return catIcon(category);
}

// Loading (B-42): a whisk stirring in a bowl, same 1px line style. The whisk is its own group so CSS can rock it.
export function whiskIcon() {
  const line = d => `<path d="${d}" vector-effect="non-scaling-stroke"/>`;
  return `<svg class="whisk-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g class="whisk">${line("M15.5 2L12.5 7")}${line("M12.5 7C10.6 7.6 9.2 9.8 9.8 11.8C10.4 13.6 12.8 12.9 13.6 10.9C14.3 9.1 13.7 7.7 12.5 7Z")}<path d="M12.5 7C11.7 8.7 11.4 10.6 11.6 12.4" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/></g>
    ${line("M3 11H16.3333C16.3333 12.7681 15.631 14.4638 14.3807 15.714C13.1305 16.9643 11.4348 17.6667 9.66667 17.6667C7.89856 17.6667 6.20286 16.9643 4.95262 15.714C3.70238 14.4638 3 12.7681 3 11Z")}
    <path d="M5.5 8.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0Z" fill="currentColor" stroke="none"/>
  </svg>`;
}
