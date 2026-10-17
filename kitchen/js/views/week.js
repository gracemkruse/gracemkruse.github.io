import * as data from "../data.js";
import { icon, tagIcon } from "../icons.js";
import { pickRecipe } from "../pickers.js";
import { esc, $, $$, toast, minutes, iso, fromIso, addDays, weekStart, dayLabel, rangeLabel, monthDay } from "../ui.js";

// This Week. Optional ?w=YYYY-MM-DD (any Monday) to view another week.
let editing = false;

export async function weekView(app, startIso) {
  const thisMonday = weekStart();
  const start = startIso ? weekStart(fromIso(startIso)) : thisMonday;
  const end = addDays(start, 6);
  const offset = Math.round((start - thisMonday) / 86400000 / 7);
  const isPast = offset < 0;
  const items = await data.listWeek(iso(start), iso(end));
  const today = iso(new Date());

  const title = offset === 0 ? "This Week" : offset === -1 ? "Last Week" : offset === 1 ? "Next Week" : `Week of ${monthDay(start)}`;
  const made = items.filter(m => m.status === "made").length;
  const summary = items.length === 0 ? "Nothing planned yet"
    : isPast ? `${made} made · ${items.length - made} not made` : `${items.length - made} planned · ${made} made`;

  const days = [0,1,2,3,4,5,6].map(i => { const d = addDays(start, i); const v = iso(d); return { d, v, label: dayLabel(d), meals: items.filter(m => m.date === v) }; });

  const mealRow = m => {
    const ic = tagIcon(m.recipe.tags), done = m.status === "made";
    return `<div class="meal${done ? " made" : ""}">
      <a class="meal-title t-recipe" href="#/recipe/${encodeURIComponent(m.recipe.id)}">${esc(m.recipe.title)}</a>
      ${ic ? icon(ic, true, "grey") : ""}${m.recipe.total_minutes ? `<span class="t-label grey">${esc(minutes(m.recipe.total_minutes))}</span>` : ""}
      <span class="spacer"></span>
      ${editing ? `<button class="t-label clay" data-remove="${esc(m.id)}">Remove</button>`
                : `<button class="ring${done ? " on" : ""}" data-toggle="${esc(m.id)}" aria-pressed="${done}" aria-label="${done ? "Made — tap to undo" : "Mark made"}">${done ? icon("check", true) : ""}</button>
                   <a class="chev grey" href="#/recipe/${encodeURIComponent(m.recipe.id)}" aria-label="Open recipe">${icon("open", true)}</a>`}
    </div>`;
  };

  app.innerHTML = `
    <section class="week">
      <div class="weeknav">
        <a class="grey" href="#/week?w=${iso(addDays(start, -7))}" aria-label="Previous week">${icon("back")}</a>
        <span class="t-label">${esc(rangeLabel(start))}</span>
        <a class="grey" href="#/week?w=${iso(addDays(start, 7))}" aria-label="Next week">${icon("open")}</a>
      </div>
      <div class="title-row">
        <h1 class="t-page page-title">${esc(title)}</h1>
        ${items.length && !isPast ? `<button class="t-label grey" data-edit>${editing ? "Done" : "Edit"}</button>` : ""}
      </div>
      <div class="t-label grey">${esc(summary)}</div>
      <hr class="rule ink" style="margin-top:24px">
      ${days.map(day => `
        <div class="day${day.v === today ? " today" : ""}">
          <div class="date t-label">${esc(day.label)}</div>
          <div class="meals">
            ${day.meals.map(mealRow).join("")}
            ${day.meals.length === 0
              ? `<div class="meal none"><span class="t-item grey">Nothing planned</span><span class="spacer"></span>${isPast ? "" : `<button class="t-label green" data-add="${day.v}" data-label="${esc(day.label)}">+ Add</button>`}</div>`
              : isPast || editing ? "" : `<div class="add-more"><button class="t-label green" data-add="${day.v}" data-label="${esc(day.label)}">+ Add</button></div>`}
          </div>
        </div>`).join("")}
      ${isPast && items.length ? `<div class="week-foot"><button class="btn-text t-label" data-copy>${icon("made", true)} Plan this week again</button></div>` : ""}
      ${offset !== 0 ? `<div class="week-foot"><a class="btn-text grey t-label" href="#/week">Back to this week</a></div>` : ""}
    </section>`;

  const rerender = () => weekView(app, iso(start));
  $$("[data-toggle]", app).forEach(b => b.onclick = async () => {
    const m = items.find(x => x.id === b.dataset.toggle);
    const next = m.status === "made" ? "planned" : "made";
    b.classList.toggle("on", next === "made"); // instant feedback
    try { await data.setMealStatus(m.id, next); } catch (e) { console.error(e); toast("Couldn’t update — try again."); }
    rerender();
  });
  $$("[data-remove]", app).forEach(b => b.onclick = async () => { await data.removeFromWeek(b.dataset.remove); rerender(); });
  $$("[data-add]", app).forEach(b => b.onclick = async () => { const added = await pickRecipe(b.dataset.add, b.dataset.label); if (added) rerender(); });
  const edit = $("[data-edit]", app); if (edit) edit.onclick = () => { editing = !editing; rerender(); };
  const copy = $("[data-copy]", app);
  if (copy) copy.onclick = async () => {
    const shift = Math.round((thisMonday - start) / 86400000);
    if (!confirm(`Copy these ${items.length} meals into this week (same days)?`)) return;
    await data.copyWeek(items, shift); toast("Copied into this week."); location.hash = "#/week";
  };
}

export function resetWeekEditing() { editing = false; }
