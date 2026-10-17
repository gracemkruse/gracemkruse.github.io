// Bottom-sheet pickers used by This Week and Recipe Detail.
import * as data from "./data.js";
import { icon, tagIcon } from "./icons.js";
import { esc, sheet, iso, addDays, weekStart, dayLabel, toast, minutes } from "./ui.js";

// Pick a day (this week + next week) for a recipe. Resolves after it's added.
export function pickDay(recipe) {
  return new Promise(resolve => {
    const today = iso(new Date());
    const weeks = [["This week", weekStart()], ["Next week", addDays(weekStart(), 7)]];
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label">Add “${esc(recipe.title)}” to…</span><button class="t-label grey" data-close>Cancel</button></div>
      ${weeks.map(([label, start]) => `
        <div class="t-label grey sheet-sub">${label}</div>
        <div class="day-grid">${[0,1,2,3,4,5,6].map(i => { const d = addDays(start, i), v = iso(d); const past = v < today;
          return `<button class="day-btn t-label${v === today ? " today" : ""}" data-date="${v}" ${past ? "disabled" : ""}>${dayLabel(d)}</button>`; }).join("")}</div>`).join("")}`, "Pick a day");
    el.addEventListener("click", async e => {
      const b = e.target.closest(".day-btn"); if (!b || b.disabled) return;
      try { await data.addToWeek(recipe.id, b.dataset.date); toast(`Added to ${b.textContent}.`); close(); resolve(b.dataset.date); }
      catch (err) { console.error(err); toast("Couldn’t add — try again."); }
    });
  });
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
        return `<button class="pick-row" data-id="${esc(r.id)}"><span class="t-recipe">${esc(r.title)}</span><span class="meta t-label grey">${ic ? icon(ic, true) : ""}${esc(meta)}</span></button>`; }).join("")
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
