import * as data from "../data.js";
import { icon, tagIcon } from "../icons.js";
import { pickRecipe, chooseDay } from "../pickers.js";
import { esc, $, $$, toast, sheet, minutes, iso, fromIso, addDays, weekStart, dayLabel, rangeLabel, monthDay, niceTitle } from "../ui.js";

// This Week. Optional ?w=YYYY-MM-DD (any Monday) to view another week.
// Meals: swipe left to remove (with Undo), swipe right for options (phone/iPad); ⋯ menu on desktop.

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
    return `<div class="meal-swipe" data-meal="${esc(m.id)}">
      <div class="meal-under" aria-hidden="true">
        <span class="under-opts">${isPast ? "" : `<button class="t-label green" data-move="${esc(m.id)}" tabindex="-1">Move</button>`}<a class="t-label green" href="#/recipe/${encodeURIComponent(m.recipe.id)}" tabindex="-1">Open</a></span>
        <span class="under-remove t-label">Remove</span>
      </div>
      <div class="meal${done ? " made" : ""}">
        <a class="meal-title t-recipe recipe-name" href="#/recipe/${encodeURIComponent(m.recipe.id)}">${esc(niceTitle(m.recipe.title))}</a>
        ${ic ? icon(ic, true, "grey") : ""}${m.recipe.total_minutes ? `<span class="t-label grey">${esc(minutes(m.recipe.total_minutes))}</span>` : ""}
        <span class="spacer"></span>
        <button class="ring${done ? " on" : ""}" data-toggle="${esc(m.id)}" aria-pressed="${done}" aria-label="${done ? "Made — tap to undo" : "Mark made"}">${done ? icon("check", true) : ""}</button>
        <button class="meal-menu grey" data-menu="${esc(m.id)}" aria-label="More for ${esc(m.recipe.title)}">⋯</button>
      </div>
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
              : isPast ? "" : `<div class="add-more"><button class="t-label green" data-add="${day.v}" data-label="${esc(day.label)}">+ Add</button></div>`}
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
  $$("[data-add]", app).forEach(b => b.onclick = async () => { const added = await pickRecipe(b.dataset.add, b.dataset.label); if (added) rerender(); });

  // ---- remove (with Undo), move, menu ----
  const find = id => items.find(x => x.id === id);
  const remove = async m => {
    try { await data.removeFromWeek(m.id); } catch (e) { console.error(e); toast("Couldn’t remove — try again."); return rerender(); }
    rerender();
    toast(`Removed ${m.recipe.title}.`, { label: "Undo", run: async () => { await data.addToWeek(m.recipe.id, m.date); if (m.status === "made") { const back = (await data.listWeek(m.date, m.date)).filter(x => x.recipe.id === m.recipe.id).pop(); if (back) await data.setMealStatus(back.id, "made"); } rerender(); } });
  };
  const move = async m => {
    const day = await chooseDay(`Move “<span class="recipe-name">${esc(niceTitle(m.recipe.title))}</span>” to…`, m.date); if (!day) return rerender();
    try { await data.moveMeal(m.id, day.date); toast(`Moved to ${day.label}.`); } catch (e) { console.error(e); toast("Couldn’t move — try again."); }
    rerender();
  };
  $$("[data-move]", app).forEach(b => b.onclick = () => move(find(b.dataset.move)));
  $$("[data-menu]", app).forEach(b => b.onclick = () => {
    const m = find(b.dataset.menu);
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label recipe-name">${esc(niceTitle(m.recipe.title))}</span><button class="t-label grey" data-close>Cancel</button></div>
      <div class="pick-list">
        <a class="menu-row t-item" href="#/recipe/${encodeURIComponent(m.recipe.id)}" data-close>Open recipe</a>
        ${isPast ? "" : `<button class="menu-row t-item" data-act="move">Move to another day</button>`}
        <button class="menu-row t-item clay" data-act="remove">Remove from plan</button>
      </div>`, m.recipe.title);
    el.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (!a) return; close(); a.dataset.act === "move" ? move(m) : remove(m); });
  });

  // ---- swipe (touch and pen): left past the line removes, right opens Move / Open ----
  const OPEN = 132, LIMIT = 88;
  $$(".meal-swipe", app).forEach(wrap => {
    const row = $(".meal", wrap); let x0 = 0, y0 = 0, dx = 0, mode = null, base = 0;
    const set = (x, animate) => { row.style.transition = animate ? "transform .2s ease" : "none"; row.style.transform = x ? `translateX(${x}px)` : ""; wrap.classList.toggle("swiping-left", x < 0); wrap.classList.toggle("swiping-right", x > 0); };
    const closeOthers = () => $$(".meal-swipe.open", app).forEach(w => { if (w !== wrap) { w.classList.remove("open"); const r = $(".meal", w); r.style.transition = "transform .2s ease"; r.style.transform = ""; } });
    row.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" || e.target.closest("button")) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; mode = "maybe"; base = wrap.classList.contains("open") ? OPEN : 0;
    });
    row.addEventListener("pointermove", e => {
      if (!mode) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (mode === "maybe") {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = null; return; }   // a scroll, not a swipe
        if (Math.abs(mx) < 10) return;
        mode = "drag"; try { row.setPointerCapture(e.pointerId); } catch {} closeOthers();
      }
      dx = Math.max(-200, Math.min(OPEN + 24, base + mx)); set(dx, false);
    });
    const end = () => {
      if (mode !== "drag") { mode = null; return; }
      mode = null;
      const m = find(wrap.dataset.meal);
      if (dx <= -LIMIT) { set(-wrap.offsetWidth, true); setTimeout(() => remove(m), 180); }
      else if (dx >= LIMIT / 2) { set(OPEN, true); wrap.classList.add("open"); $$(".under-opts [tabindex]", wrap).forEach(b => b.removeAttribute("tabindex")); }
      else { set(0, true); wrap.classList.remove("open"); }
    };
    row.addEventListener("pointerup", end); row.addEventListener("pointercancel", end);
    // a tap on an open row closes it instead of following the link
    row.addEventListener("click", e => { if (wrap.classList.contains("open") && !e.target.closest("button")) { e.preventDefault(); set(0, true); wrap.classList.remove("open"); } }, true);
  });

  const copy = $("[data-copy]", app);
  if (copy) copy.onclick = async () => {
    const shift = Math.round((thisMonday - start) / 86400000);
    if (!confirm(`Copy these ${items.length} meals into this week (same days)?`)) return;
    await data.copyWeek(items, shift); toast("Copied into this week."); location.hash = "#/week";
  };
}

