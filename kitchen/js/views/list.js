import * as data from "../data.js";
import { icon, ingredientIcon, catIcon } from "../icons.js";
import { suggestGroups, titleCase } from "../ingredients.js";
import { esc, $, $$, toast, sheet, amount, iso, addDays, weekStart, monthDay } from "../ui.js";

// Shopping List: To buy / Week / Pantry (mirrors the Notion Grocery views).
//   To buy — ingredients for upcoming meals that aren't in stock, plus hand-added items. Check off → In the cart → Done shopping.
//   Week   — every ingredient the upcoming meals need, with its stock status (tap to change).
//   Pantry — every ingredient you've ever used: status, search, filter, category.
const TABS = [["buy", "To buy"], ["week", "Week"], ["pantry", "Pantry"]];
const STATUS = { in_stock: ["In stock", "green"], low: ["Low", "grey"], out: ["Out", "clay"], not_tracked: ["Not tracked", "grey"] };
const NEXT = { in_stock: "low", low: "out", out: "not_tracked", not_tracked: "in_stock" };
let pantryQuery = "", pantryFilter = "all";

export async function listView(app, tab = "buy") {
  // Upcoming meals: today through the end of next week (so weekend shopping covers next week's plan).
  const start = new Date(), end = addDays(weekStart(), 13);
  const d = await data.shoppingData(iso(start), iso(end));
  const order = d.categories.map(c => c.name);
  const toBuy = d.week.filter(i => i.stock_status !== "in_stock" || i.in_cart);
  const openCount = toBuy.filter(i => !i.in_cart).length + d.extras.filter(x => !x.in_cart).length;
  const rerender = () => listView(app, tab);

  const qty = i => i.amounts.map(a => amount(a.amount, a.unit)).filter(Boolean).join(" + ");
  const flag = s => s === "out" ? `<span class="t-label clay">Out</span>` : s === "low" ? `<span class="t-label grey">Low</span>` : "";
  const statusBtn = i => { const [label, cls] = STATUS[i.stock_status] || STATUS.not_tracked;
    return `<button class="status t-label ${cls}" data-status="${esc(i.ingredient_id)}" data-now="${esc(i.stock_status)}" aria-label="${esc(i.name)}: ${label}. Tap to change">${label}</button>`; };
  const box = (on, attr) => `<button class="box${on ? " on" : ""}" ${attr} aria-pressed="${on}" aria-label="${on ? "In the cart — tap to undo" : "Got it"}">${on ? icon("check", true) : ""}</button>`;

  // Rows grouped under vertical category labels, in store order.
  const groups = (items, row, label = null) => {
    const by = new Map(order.map(n => [n, []]));
    for (const it of items) { const c = by.has(it.category) ? it.category : "Pantry"; by.get(c).push(it); }
    return [...by].filter(([, list]) => list.length).map(([cat, list]) => `
      <div class="group" style="min-height:${Math.ceil(((label || cat).length * 8 + 32) / 4) * 4}px">
        <div class="cat t-label">${icon(catIcon(cat), true)}<span>${esc(label || cat)}</span></div>
        <div class="rows">${list.map(row).join("")}</div>
      </div>`).join("");
  };

  let body = "";
  if (tab === "buy") {
    const rowIng = i => `<div class="srow${i.in_cart ? " done" : ""}">
        ${box(i.in_cart, `data-cart="${esc(i.ingredient_id)}"`)}
        ${icon(ingredientIcon(i.name, i.category), false, "ing")}
        <span class="name t-item">${esc(i.name)}</span>${i.in_cart ? "" : flag(i.stock_status)}
        <span class="spacer"></span><span class="qty t-label grey">${esc(qty(i))}</span>
      </div>`;
    const rowExtra = x => `<div class="srow${x.in_cart ? " done" : ""}">
        ${box(x.in_cart, `data-extra="${esc(x.id)}"`)}
        ${icon(ingredientIcon(x.name, x.category), false, "ing")}
        <span class="name t-item">${esc(x.name)}</span><span class="spacer"></span>
        <button class="rm grey" data-rm="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">${icon("close", true)}</button>
      </div>`;
    const open = [...toBuy.filter(i => !i.in_cart).map(i => ({ ...i, row: rowIng })), ...d.extras.filter(x => !x.in_cart).map(x => ({ ...x, row: rowExtra }))];
    const cart = [...toBuy.filter(i => i.in_cart).map(i => ({ ...i, row: rowIng })), ...d.extras.filter(x => x.in_cart).map(x => ({ ...x, row: rowExtra }))];
    body = `
      <form class="add-item input-line" autocomplete="off">${icon("plus", false, "green")}<input class="t-item" name="item" placeholder="Add an item" aria-label="Add an item"></form>
      ${open.length ? groups(open, x => x.row(x)) : `<p class="t-item grey list-empty">${cart.length ? "Everything’s in the cart." : "Nothing to buy. Plan meals in This Week, or add an item above."}</p>`}
      ${cart.length ? `
        <div class="cart-head t-label">In the cart · ${cart.length}</div>
        <div class="cart">${cart.map(x => x.row(x)).join("")}</div>
        <div class="list-foot"><button class="btn-primary t-label" data-finish>${icon("check", true)} Done shopping</button></div>` : ""}`;
  } else if (tab === "week") {
    const rowWeek = i => `<div class="srow">
        ${icon(ingredientIcon(i.name, i.category), false, "ing")}
        <span class="name t-item" title="${esc(i.recipes.join(", "))}">${esc(i.name)}</span>
        <span class="qty t-label grey">${esc(qty(i))}</span><span class="spacer"></span>${statusBtn(i)}
      </div>`;
    body = d.week.length ? groups(d.week, rowWeek) : `<p class="t-item grey list-empty">No meals planned between now and the end of next week. <a class="green" href="#/week">Plan some</a>.</p>`;
  } else {
    const q = pantryQuery.trim().toLowerCase();
    const shown = d.pantry.filter(i => (!q || i.name.toLowerCase().includes(q)) && (pantryFilter === "all" || i.stock_status === pantryFilter));
    const rowPantry = i => `<div class="srow">
        ${icon(ingredientIcon(i.name, i.category), false, "ing")}
        <button class="name t-item" data-ing="${esc(i.ingredient_id)}" aria-label="Edit ${esc(i.name)}">${esc(i.name)}</button>
        <span class="spacer"></span>${statusBtn(i)}
      </div>`;
    const count = s => d.pantry.filter(i => i.stock_status === s).length;
    const dupes = suggestGroups(d.pantry).length;
    body = `
      ${dupes ? `<div class="tidy-line"><span class="t-label grey">Some ingredients look like the same thing.</span><button class="btn-text t-label" data-tidy>Tidy up · ${dupes}</button></div>` : ""}
      <label class="input-line">${icon("search", false, "grey")}<input class="t-item" type="search" data-q placeholder="Search ${d.pantry.length} ingredients" value="${esc(pantryQuery)}"></label>
      <div class="chips filters">${[["all", "All"], ["out", `Out ${count("out")}`], ["low", `Low ${count("low")}`], ["in_stock", `In stock ${count("in_stock")}`]]
        .map(([k, l]) => `<button class="chip t-label" aria-pressed="${pantryFilter === k}" data-filter="${k}">${l}</button>`).join("")}</div>
      ${shown.length ? groups(shown, rowPantry) : `<p class="t-item grey list-empty">${d.pantry.length ? "No match." : "Ingredients appear here once you add recipes."}</p>`}`;
  }

  app.innerHTML = `
    <section class="list">
      <h1 class="t-page page-title">Shopping List</h1>
      <div class="t-label grey">${tab === "buy" ? `${openCount} to buy · ` : ""}Meals ${esc(monthDay(start))} — ${esc(monthDay(end))}</div>
      <nav class="list-tabs">${TABS.map(([k, l]) => `<a class="t-label${k === tab ? " active" : ""}" href="#/list${k === "buy" ? "" : "?tab=" + k}">${l}</a>`).join("")}</nav>
      ${body}
    </section>`;

  const run = async (fn, msg = "Couldn’t update — try again.") => { try { await fn(); } catch (e) { console.error(e); toast(msg); } rerender(); };
  $$("[data-cart]", app).forEach(b => b.onclick = () => { b.classList.toggle("on"); run(() => data.setInCart(b.dataset.cart, b.getAttribute("aria-pressed") !== "true")); });
  $$("[data-extra]", app).forEach(b => b.onclick = () => { b.classList.toggle("on"); run(() => data.setExtraInCart(b.dataset.extra, b.getAttribute("aria-pressed") !== "true")); });
  $$("[data-rm]", app).forEach(b => b.onclick = () => run(() => data.removeExtra(b.dataset.rm)));
  $$("[data-status]", app).forEach(b => b.onclick = () => run(() => data.setStock(b.dataset.status, NEXT[b.dataset.now] || "in_stock")));
  const finish = $("[data-finish]", app);
  if (finish) finish.onclick = () => run(async () => {
    const ids = toBuy.filter(i => i.in_cart).map(i => i.ingredient_id);
    await data.finishShopping(ids); toast(ids.length ? `${ids.length} marked in stock.` : "Cart cleared.");
  });
  const add = $(".add-item", app);
  if (add) add.onsubmit = e => { e.preventDefault(); const name = add.item.value.trim(); if (!name) return;
    run(async () => { await data.addExtra(name); requestAnimationFrame(() => $(".add-item input", app)?.focus()); }, "Couldn’t add — try again."); };
  // Search filters the rows in place (no reload per keystroke).
  const qIn = $("[data-q]", app);
  const filterRows = () => {
    const q = pantryQuery.trim().toLowerCase();
    $$(".group", app).forEach(gr => { let any = false;
      $$(".srow", gr).forEach(r => { const hit = !q || r.querySelector(".name").textContent.toLowerCase().includes(q); r.hidden = !hit; any ||= hit; });
      gr.hidden = !any; });
  };
  if (qIn) { qIn.oninput = () => { pantryQuery = qIn.value; filterRows(); }; }
  $$("[data-filter]", app).forEach(b => b.onclick = () => { pantryFilter = b.dataset.filter; rerender(); });
  $$("[data-ing]", app).forEach(b => b.onclick = () => editIngredient(d.pantry.find(i => String(i.ingredient_id) === b.dataset.ing), d.pantry, order, rerender));
  const tidy = $("[data-tidy]", app); if (tidy) tidy.onclick = () => tidySheet(d.pantry, rerender);
}

// ---------- Edit one ingredient: name, category, stock, recipes, merge ----------
async function editIngredient(it, pantry, order, done) {
  const id = String(it.ingredient_id);
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">Ingredient</span><button class="t-label grey" data-close>Close</button></div>
    <form class="rename input-line" autocomplete="off">${icon(ingredientIcon(it.name, it.category))}<input class="t-item" name="n" value="${esc(it.name)}" aria-label="Name"><button class="btn-text t-label" type="submit">Save</button></form>
    <div class="t-label grey sheet-sub">Stock</div>
    <div class="chips">${Object.entries(STATUS).map(([k, [l]]) => `<button class="chip t-label" data-st="${k}" aria-pressed="${it.stock_status === k}">${l}</button>`).join("")}</div>
    <div class="t-label grey sheet-sub">Category</div>
    <div class="chips">${order.map(c => `<button class="chip t-label" data-c="${esc(c)}" aria-pressed="${c === it.category}">${esc(c)}</button>`).join("")}</div>
    <div class="t-label grey sheet-sub" data-used>Used in…</div>
    <div class="used"></div>
    <div class="t-label grey sheet-sub">Merge into another ingredient</div>
    <label class="input-line">${icon("search", false, "grey")}<input class="t-item" data-mq placeholder="Search to merge “${esc(it.name)}” into…"></label>
    <div class="pick-list merge-list"></div>`, "Edit ingredient");
  let changed = false;
  const finish = () => { close(); if (changed) done(); };
  el.querySelectorAll("[data-close]").forEach(b => b.onclick = finish);
  const act = async (fn, msg) => { try { await fn(); changed = true; if (msg) toast(msg); } catch (e) { console.error(e); toast(e.message || "Couldn’t save — try again."); } };

  el.querySelector(".rename").onsubmit = async e => {
    e.preventDefault(); const n = e.target.n.value.trim(); if (!n || n === it.name) return;
    const clash = pantry.find(x => x.name.toLowerCase() === n.toLowerCase() && String(x.ingredient_id) !== id);
    if (clash && !confirm(`“${clash.name}” already exists. Merge “${it.name}” into it?`)) return;
    await act(() => data.renameIngredient(id, n), clash ? `Merged into ${clash.name}.` : "Renamed."); finish();
  };
  el.querySelectorAll("[data-st]").forEach(b => b.onclick = () => act(async () => { await data.setStock(id, b.dataset.st); el.querySelectorAll("[data-st]").forEach(x => x.setAttribute("aria-pressed", x === b)); }));
  el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => act(async () => { await data.setCategory(id, b.dataset.c); el.querySelectorAll("[data-c]").forEach(x => x.setAttribute("aria-pressed", x === b)); }));

  const recipes = await data.ingredientRecipes(id).catch(() => []);
  el.querySelector("[data-used]").textContent = recipes.length ? `Used in ${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : "Not used in any recipe";
  el.querySelector(".used").innerHTML = recipes.length
    ? recipes.map((r, n) => `<a class="used-row t-item" href="#/recipe/${encodeURIComponent(r.id)}"${n >= 5 ? " hidden" : ""}>${esc(r.title)}</a>`).join("") +
      (recipes.length > 5 ? `<button class="btn-text grey t-label" data-more>Show all ${recipes.length}</button>` : "")
    : `<button class="btn-text grey t-label" data-del>Remove from pantry</button>`;
  el.querySelectorAll(".used-row").forEach(a => a.addEventListener("click", () => close()));
  const more = el.querySelector("[data-more]"); if (more) more.onclick = () => { el.querySelectorAll(".used-row").forEach(a => (a.hidden = false)); more.remove(); };
  const del = el.querySelector("[data-del]");
  if (del) del.onclick = async () => { if (!confirm(`Remove “${it.name}”?`)) return; await act(() => data.deleteIngredient(id), "Removed."); finish(); };

  const mq = el.querySelector("[data-mq]"), ml = el.querySelector(".merge-list");
  mq.oninput = () => {
    const q = mq.value.trim().toLowerCase();
    const hits = q ? pantry.filter(x => String(x.ingredient_id) !== id && x.name.toLowerCase().includes(q)).slice(0, 8) : [];
    ml.innerHTML = hits.map(x => `<button class="pick-row" data-into="${esc(x.ingredient_id)}"><span class="t-item">${esc(x.name)}</span><span class="meta t-label grey">${esc(x.category)}</span></button>`).join("");
  };
  ml.onclick = async e => {
    const b = e.target.closest("[data-into]"); if (!b) return;
    const into = pantry.find(x => String(x.ingredient_id) === b.dataset.into);
    if (!confirm(`Merge “${it.name}” into “${into.name}”? Recipes that use “${it.name}” will use “${into.name}”.`)) return;
    await act(() => data.mergeIngredients(String(into.ingredient_id), [id]), `Merged into ${into.name}.`); finish();
  };
}

// ---------- Tidy up: review suggested duplicate groups, merge the ones you keep ----------
function tidySheet(pantry, done) {
  const groups = suggestGroups(pantry);
  const off = new Set();                      // "g:i" member keys you excluded
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">Tidy up · ${groups.length} groups</span><button class="t-label grey" data-close>Cancel</button></div>
    <p class="t-instr" style="margin:12px 0 0">Each group becomes one ingredient. Tap a name to leave it out. Words like “zest” or “chopped” move onto the recipe line, so recipes still read right.</p>
    <div class="tidy-list">${groups.map((g, gi) => `
      <div class="tidy-group" data-g="${gi}">
        <div class="tidy-head"><button class="box on" data-gon="${gi}" aria-pressed="true" aria-label="Merge this group">${icon("check", true)}</button>
          <input class="t-item tidy-name" data-gname="${gi}" value="${esc(g.name)}" aria-label="Merged name"></div>
        <div class="chips tidy-members">${g.members.map((m, mi) => `<button class="chip t-label" data-m="${gi}:${mi}" aria-pressed="true">${esc(m.name)}</button>`).join("")}</div>
      </div>`).join("")}</div>
    <div class="tidy-foot"><button class="btn-primary t-label" data-merge>Merge ${groups.length} groups</button><span class="t-label grey" data-tstatus></span></div>`, "Tidy up ingredients");
  const chosen = () => groups.map((g, gi) => ({ g, gi, on: el.querySelector(`[data-gon="${gi}"]`).classList.contains("on"),
    members: g.members.filter((m, mi) => !off.has(`${gi}:${mi}`)), name: el.querySelector(`[data-gname="${gi}"]`).value.trim() || g.name }))
    .filter(x => x.on && x.members.length > 1);
  const count = () => { const n = chosen().length; const b = el.querySelector("[data-merge]"); b.textContent = `Merge ${n} group${n === 1 ? "" : "s"}`; b.disabled = !n; };
  el.addEventListener("click", e => {
    const g = e.target.closest("[data-gon]");
    if (g) { const on = !g.classList.contains("on"); g.classList.toggle("on", on); g.setAttribute("aria-pressed", on); g.innerHTML = on ? icon("check", true) : ""; g.closest(".tidy-group").classList.toggle("off", !on); count(); return; }
    const m = e.target.closest("[data-m]");
    if (m) { const k = m.dataset.m; off.has(k) ? off.delete(k) : off.add(k); m.setAttribute("aria-pressed", !off.has(k)); count(); }
  });
  el.querySelector("[data-merge]").onclick = async e => {
    const list = chosen(); if (!list.length) return;
    const btn = e.currentTarget, st = el.querySelector("[data-tstatus]"); btn.disabled = true;
    let n = 0;
    for (const x of list) {
      st.textContent = `Merging ${++n} of ${list.length}: ${x.name}…`;
      try { await data.mergeGroup(titleCase(x.name), x.members, pantry); }
      catch (err) { console.error(err); toast(`Couldn’t merge ${x.name} — the rest continue.`); }
    }
    toast(`Merged ${list.length} groups.`); close(); done();
  };
  count();
}
