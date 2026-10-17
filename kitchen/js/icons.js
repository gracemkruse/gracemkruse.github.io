// Geometric icon set (mirrors Figma "Icon/*"). 24-unit grid, drawn with a 1px non-scaling line,
// at most one small solid ("fill") per icon. Use icon(name) for 20px, icon(name, true) for 16px inline.
const F = 'fill="currentColor" stroke="none"';
const D = 'stroke-dasharray="2 2"';
const PATHS = {
  // categories
  produce: `<path d="M12 3c5 4 6 9 0 18-6-9-5-14 0-18z"/><path d="M12 7v14" ${D}/><circle cx="12" cy="21" r="1" ${F}/>`,
  protein: `<path d="M4 14a8 8 0 0 1 16 0z"/><path d="M4 18h16" ${D}/><circle cx="12" cy="10" r="1" ${F}/>`,
  dairy: `<path d="M12 3l6 9a6 6 0 1 1-12 0z"/><path d="M8 15h8" ${D}/>`,
  pantry: `<path d="M4 20V16H8V12H12V8H16V4H20V20Z"/><path d="M8 16H20M12 12H20M16 8H20M8 16V20M12 12V20M16 8V20"/>`,
  herbs: `<circle cx="12" cy="12" r="8"/><path d="M12 7v10M8 9.5l8 5M16 9.5l-8 5"/>`,
  household: `<rect x="4" y="4" width="16" height="16" ${D}/><rect x="14" y="4" width="6" height="6" ${F}/>`,
  // recipe tags
  soup: `<path d="M4 13h16a8 8 0 0 1-16 0z"/><path d="M12 10V4M8 10L6 6M16 10l2-4"/>`,
  pasta: `<path d="M4 13h16a8 8 0 0 1-16 0z"/><path d="M7 10c1-2 2 2 3 0s2 2 3 0 2 2 3 0" ${D}/>`,
  baking: `<path d="M12 21V9"/><circle cx="12" cy="6" r="2" ${F}/><path d="M12 13L8 10M12 13l4-3M12 17l-4-3M12 17l4-3"/>`,
  quick: `<path d="M13 3L6 13h6l-1 8 7-10h-6z"/>`,
  veg: `<path d="M12 3c5 4 6 9 0 18-6-9-5-14 0-18z"/><path d="M12 7v14" ${D}/><circle cx="12" cy="21" r="1" ${F}/>`,
  // facts
  time: `<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="1" ${F}/>`,
  serves: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" ${D}/><circle cx="12" cy="12" r="1" ${F}/>`,
  made: `<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/><circle cx="12" cy="12" r="1" ${F}/>`,
  source: `<path d="M7 17L17 7M9 7h8v8"/>`,
  // ingredients (shopping rows; anything unmatched uses its category icon)
  lemon: `<ellipse cx="12" cy="12" rx="8" ry="6"/><path d="M4 12H2M20 12h2"/><circle cx="12" cy="12" r="1" ${F}/>`,
  onion: `<path d="M12 4c-1 3-7 6-7 11a7 7 0 0 0 14 0c0-5-6-8-7-11z"/><path d="M12 8c-2 3-3 5-3 9M12 8c2 3 3 5 3 9" ${D}/>`,
  garlic: `<path d="M12 3v4M12 7c-5 2-7 5-7 8a7 5 0 0 0 14 0c0-3-2-6-7-8z"/><path d="M12 9v11" ${D}/>`,
  tomato: `<circle cx="12" cy="13" r="8"/><path d="M8 6l4 2 4-2M12 8V4"/><circle cx="12" cy="8" r="1" ${F}/>`,
  chicken: `<path d="M14 10a6 6 0 1 0-4 7l3 3M13 20l1-1M20 17l-1 1M14 10l4 4"/><circle cx="11" cy="11" r="1" ${F}/>`,
  egg: `<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>`,
  feta: `<path d="M4 9l8-4 8 4v8l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v8"/><circle cx="16" cy="13" r="1" ${F}/>`,
  yogurt: `<path d="M5 8h14l-2 12H7z"/><path d="M5 5h14v3H5z"/><path d="M7 13h10" ${D}/>`,
  beans: `<path d="M6 4h12v16H6z"/><path d="M6 8h12M6 16h12"/><circle cx="12" cy="12" r="1" ${F}/>`,
  stock: `<path d="M5 9h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M3 9h18M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>`,
  flour: `<path d="M7 6l2-2h6l2 2v14H7z"/><path d="M7 10h10"/><path d="M10 14h4" ${D}/>`,
  paprika: `<path d="M9 8h6v12H9z"/><path d="M9 5h6v3H9z"/><path d="M9 14h6" ${D}/><circle cx="12" cy="17" r="1" ${F}/>`,
  coffee: `<path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2M9 6V4M12 6V4"/>`,
  towels: `<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 19h8" ${D}/>`,
  parsley: `<path d="M12 21V11M12 11c-4 0-6-3-5-7 3 0 5 3 5 7zM12 14c3 0 5-2 5-6-3 0-5 2-5 6z"/>`,
  // interface
  search: `<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  check: `<path d="M6 12.5l4 4 8-9"/>`,
  back: `<path d="M15 6l-6 6 6 6"/>`,
  open: `<path d="M9 6l6 6-6 6"/>`,
  play: `<path d="M8 5l11 7-11 7z"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
};

export function icon(name, inline = false, extraClass = "") {
  const d = PATHS[name];
  if (!d) return "";
  return `<svg class="icon${inline ? " inline" : ""}${extraClass ? " " + extraClass : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.replace(/<(path|circle|rect)/g, '<$1 vector-effect="non-scaling-stroke"')}</svg>`;
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
