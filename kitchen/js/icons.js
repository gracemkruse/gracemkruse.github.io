// Geometric icon set, exported from the Figma style guide ("04 Style Guide" → Icon/*, Icon/ingredient/*).
// 20-unit grid, 1px non-scaling line, at most one small solid per icon. icon(name) = 20px, icon(name, true) = 16px inline.
// To update: export the component as SVG in Figma and paste its <path>s here (stroke → line, fill → solid).
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
  source: L("M6 14.3333L14.3333 6M14.3333 12.6667V6H7.66667"),
  // interface
  search: L(circ(9, 9, 5)) + L("M16.75 16.75L13 13"),
  plus: L("M9.83333 4V15.6667M4 9.83333H15.6667"),
  check: L("M5 10.1667L8.33333 13.5L15 6"),
  back: L("M13 5L8 10L13 15"),
  open: L("M8 5L13 10L8 15"),
  down: L("M5 8L10 13L15 8"),
  play: L("M7 4L16.1667 9.83333L7 15.6667V4Z"),
  sync: L("M3 10.5C2.99856 9.14525 3.4099 7.82222 4.17922 6.7071C4.94854 5.59199 6.03934 4.73772 7.30633 4.25807C8.57333 3.77842 9.95639 3.69616 11.2713 4.02224C12.5862 4.34833 13.7706 5.06727 14.6667 6.08333M16.3333 10.5C16.3348 11.8547 15.9234 13.1778 15.1541 14.2929C14.3848 15.408 13.294 16.2623 12.027 16.7419C10.76 17.2216 9.37696 17.3038 8.06204 16.9778C6.74712 16.6517 5.56275 15.9327 4.66667 14.9167M14.6667 3V6.33333H11.3333M4.66667 18V14.6667H8"),
  close: L("M5 5L15 15M15 5L5 15"),   // not in Figma yet: same 1px line style
  // ingredients (shopping rows; anything unmatched uses its category icon)
  lemon: L(RING) + L(circ(10.1667, 10.1667, 4.1667)) + L("M10 6V14.3333") + S(DOT),
  parsley: L("M10 17.3333V9") + L("M10.1667 9.16667C7.66667 9.16667 6 7.5 6 5C8.5 5 10.1667 6.66667 10.1667 9.16667ZM10.1667 9.16667C10.1667 6.66667 11.8333 5 14.3333 5C14.3333 7.5 12.6667 9.16667 10.1667 9.16667Z") + S(dot(9.8333, 13.8333)),
  onion: L(circ(9.8333, 10.8333, 5.8333)) + L(circ(10.3333, 11.3333, 3.3333)) + S(dot(9.8333, 10.8333)) + L("M10 5.5V3"),
  garlic: L("M10 3C10 5.5 15 8 15 12.1667C15 13.4927 14.4732 14.7645 13.5355 15.7022C12.5979 16.6399 11.3261 17.1667 10 17.1667C8.67392 17.1667 7.40215 16.6399 6.46447 15.7022C5.52678 14.7645 5 13.4927 5 12.1667C5 8 10 5.5 10 3Z") + D("M10 8V16.3333"),
  tomato: L(circ(9.8333, 10.8333, 5.8333)) + L("M13 4.66667L10.5 6.33333L8 4.66667M10.5 6.33333V3") + S(dot(12.8333, 11.8333)),
  chicken: L(circ(12.1667, 7.1667, 4.1667)) + L("M9 11L4 16") + S(circ(4.6667, 15.6667, 1.6667)),
  egg: L("M9.83333 3C13.1667 3 15.6667 8.83333 15.6667 12.1667C15.6667 13.7138 15.0521 15.1975 13.9581 16.2915C12.8642 17.3854 11.3804 18 9.83333 18C8.28624 18 6.80251 17.3854 5.70854 16.2915C4.61458 15.1975 4 13.7138 4 12.1667C4 8.83333 6.5 3 9.83333 3Z") + D(circ(10.5, 12.5, 2.5)) + S(dot(9.8333, 12.8333)),
  feta: L("M3 15.1667L17.1667 6V15.1667H3Z") + S(dot(12.8333, 11.8333)) + L(circ(13.8333, 8.8333, 0.8333)),
  yogurt: L("M5 8H15L13.3333 17.1667H6.66667L5 8Z") + L("M4 8H15.6667") + D("M7 11.2406C7.83333 10.4072 9.5 12.0739 10.3333 11.2406C11.1667 10.4072 12.8333 12.0739 13.6667 11.2406"),
  beans: L("M16.3333 5H3V15H16.3333V5Z") + S(circ(6.6667, 9.6667, 1.6667)) + S(circ(9.6667, 9.6667, 1.6667)) + L(circ(13.6667, 9.6667, 1.6667)),
  stock: L(BOWL) + L("M10 8V3M6.66667 8L5 4.66667M13.3333 8L15 4.66667"),
  flour: L("M5.66667 7H14L15.6667 17H4L5.66667 7Z") + L("M7.83333 6.33333L7 3H13.6667L12.8333 6.33333") + S(dot(8.8333, 11.8333)) + L(circ(11.8333, 11.8333, 0.8333)) + L(circ(9.8333, 13.8333, 0.8333)),
  paprika: [[5.6667, 5.6667, 0], [9.6667, 5.6667, 1], [14.6667, 5.6667, 1], [5.6667, 9.6667, 1], [9.6667, 9.6667, 0], [14.6667, 9.6667, 1], [5.6667, 14.6667, 0], [9.6667, 14.6667, 1], [14.6667, 14.6667, 0]]
    .map(([x, y, solid]) => (solid ? S : L)(circ(x, y, 1.6667))).join(""),
  coffee: L("M4 8H13.1667V12.1667C13.1667 13.2717 12.7277 14.3315 11.9463 15.1129C11.1649 15.8943 10.1051 16.3333 9 16.3333H8.16667C7.0616 16.3333 6.00179 15.8943 5.22039 15.1129C4.43899 14.3315 4 13.2717 4 12.1667V8Z") + L("M13 10H14.6667C15.1087 10 15.5326 10.1756 15.8452 10.4882C16.1577 10.8007 16.3333 11.2246 16.3333 11.6667C16.3333 12.1087 16.1577 12.5326 15.8452 12.8452C15.5326 13.1577 15.1087 13.3333 14.6667 13.3333H13") + D("M8 3V6.33333M10.5 3V6.33333"),
  towels: L("M10 6.33333C12.7614 6.33333 15 5.58714 15 4.66667C15 3.74619 12.7614 3 10 3C7.23858 3 5 3.74619 5 4.66667C5 5.58714 7.23858 6.33333 10 6.33333Z") + L("M5 5V15C5 15.8333 7.5 16.6667 10 16.6667C12.5 16.6667 15 15.8333 15 15V5") + D("M5 11H15") + S(dot(9.8333, 4.8333)),
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

// Ingredient icon for a shopping row: a matching drawing, otherwise the category icon.
const ING_ICON = [
  ["lemon", /\b(lemons?|limes?)\b/], ["onion", /\b(onions?|shallots?|scallions?|leeks?)\b/], ["garlic", /\bgarlic\b/],
  ["beans", /\b(beans|chickpeas|lentils|crushed|canned)\b/], // before tomato: canned tomatoes get the can
  ["tomato", /\btomato(es)?\b/], ["chicken", /\b(chicken|turkey)\b/], ["egg", /\beggs?\b/],
  ["feta", /\b(feta|cheddar|parmesan|pecorino|mozzarella|cheese)\b/], ["yogurt", /\b(yogh?urt|sour cream|miso)\b/],
  ["stock", /\b(stock|broth|dashi)\b/],
  ["flour", /\b(flour|sugar|yeast)\b/], ["paprika", /\b(paprika|cumin|black pepper|peppercorns|salt|chili|cinnamon|turmeric)\b/],
  ["coffee", /\b(coffee|tea)\b/], ["towels", /\b(paper towels?|towels?|toilet paper)\b/], ["parsley", /\b(parsley|cilantro|basil|dill|mint|herbs)\b/],
];
const CAT_ICON = { "produce": "produce", "protein": "protein", "dairy": "dairy", "pantry": "pantry", "herbs & spices": "herbs", "household": "household" };
export function catIcon(category) { return CAT_ICON[String(category || "").toLowerCase()] || "pantry"; }
export function ingredientIcon(name, category) {
  const n = String(name || "").toLowerCase();
  for (const [k, re] of ING_ICON) if (re.test(n)) return k;
  return catIcon(category);
}
