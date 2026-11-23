// Bottom-sheet pickers used by This Week and Recipe Detail.
import * as data from "./data.js";
import { icon, tagIcon } from "./icons.js";
import { esc, sheet, iso, addDays, weekStart, dayLabel, toast, minutes, niceTitle } from "./ui.js";

// Day grid (this week + next week, past days disabled). Resolves "YYYY-MM-DD", or null if cancelled.
export function chooseDay(heading, current = null) {
  return new Promise(resolve => {
    const today = iso(new Date());
    const weeks = [["This week", weekStart()], ["Next week", addDays(weekStart(), 7)]];
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label">${heading}</span><button class="t-label grey" data-close>Cancel</button></div>
      ${weeks.map(([label, start]) => `
        <div class="t-label grey sheet-sub">${label}</div>
        <div class="day-grid">${[0,1,2,3,4,5,6].map(i => { const d = addDays(start, i), v = iso(d); const past = v < today;
          return `<button class="day-btn t-label${v === today ? " today" : ""}" data-date="${v}" ${past || v === current ? "disabled" : ""}>${dayLabel(d)}</button>`; }).join("")}</div>`).join("")}`, "Pick a day");
    el.closest(".sheet-wrap").querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => resolve(null)));
    el.addEventListener("click", e => { const b = e.target.closest(".day-btn"); if (!b || b.disabled) return; close(); resolve({ date: b.dataset.date, label: b.textContent }); });
  });
}

// Pick a day for a recipe and add it. Resolves after it's added.
export async function pickDay(recipe) {
  const day = await chooseDay(`Add “<span class="recipe-name">${esc(niceTitle(recipe.title))}</span>” to…`);
  if (!day) return null;
  try { await data.addToWeek(recipe.id, day.date); toast(`Added to ${day.label}.`); return day.date; }
  catch (err) { console.error(err); toast("Couldn’t add — try again."); return null; }
}

// Pick a recipe to put on a given day.
export async function pickRecipe(date, label) {
  const recipes = await data.listRecipes();
  return new Promise(resolve => {
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label">Add to ${esc(label)}</span><button class="t-label grey" data-close>Cancel</button></div>
      <label class="input-line">${icon("search", false, "grey")}<input class="t-item" type="search" placeholder="Search ${recipes.length} recipes"></label>
      <div class="pick-list"></div>`, "Pick a recipe");
    const list = el.querySelector(".pick-list"), input = el.querySelector("input");
    const paint = () => {
      const q = input.value.trim().toLowerCase();
      const shown = recipes.filter(r => !q || r.title.toLowerCase().includes(q));
      list.innerHTML = shown.length ? shown.map(r => { const ic = tagIcon(r.tags); const meta = [r.tags[0], minutes(r.total_minutes)].filter(Boolean).join(" · ");
        return `<button class="pick-row" data-id="${esc(r.id)}"><span class="t-recipe recipe-name">${esc(niceTitle(r.title))}</span><span class="meta t-label grey">${ic ? icon(ic, true) : ""}${esc(meta)}</span></button>`; }).join("")
        : `<p class="t-item grey">${recipes.length ? "No match." : "No recipes yet — add one first."}</p>`;
    };
    paint(); input.oninput = paint; input.focus();
    list.addEventListener("click", async e => {
      const b = e.target.closest(".pick-row"); if (!b) return;
      try { await data.addToWeek(b.dataset.id, date); close(); resolve(true); }
      catch (err) { console.error(err); toast("Couldn’t add — try again."); }
    });
  });
}

// Tap a stock status → the four choices appear in place; tap one to set it. Resolves the new status, or null if cancelled.
const STOCK = [["in_stock", "In stock"], ["low", "Low"], ["out", "Out"], ["not_tracked", "Not tracked"]];
export function pickStatus(btn, current) {
  return new Promise(resolve => {
    const row = btn.parentElement;
    const pick = document.createElement("span");
    pick.className = "status-pick"; pick.setAttribute("role", "group"); pick.setAttribute("aria-label", "Stock status");
    pick.innerHTML = STOCK.map(([k, l]) => `<button class="t-label${k === "out" ? " clay" : k === "in_stock" ? " green" : ""}" data-s="${k}" aria-pressed="${k === current}">${l}</button>`).join("");
    row.appendChild(pick);
    pick.querySelector('[aria-pressed="true"]')?.focus();
    const done = v => { pick.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key); resolve(v); };
    const away = e => { if (!pick.contains(e.target)) done(null); };
    const key = e => { if (e.key === "Escape") done(null); };
    pick.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) done(b.dataset.s === current ? null : b.dataset.s); });
    setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", key); });
  });
}
