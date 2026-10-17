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
