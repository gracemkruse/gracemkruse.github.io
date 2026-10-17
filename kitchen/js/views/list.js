import * as data from "../data.js";
import { icon, ingredientIcon, catIcon } from "../icons.js";
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
        <button class="name t-item" data-cat="${esc(i.ingredient_id)}" aria-label="${esc(i.name)} — change category">${esc(i.name)}</button>
        <span class="spacer"></span>${statusBtn(i)}
      </div>`;
    const count = s => d.pantry.filter(i => i.stock_status === s).length;
    body = `
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
  const qIn = $("[data-q]", app);
  if (qIn) qIn.oninput = () => { pantryQuery = qIn.value; rerender().then(() => { const n = $("[data-q]", app); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); };
  $$("[data-filter]", app).forEach(b => b.onclick = () => { pantryFilter = b.dataset.filter; rerender(); });
  $$("[data-cat]", app).forEach(b => b.onclick = () => {
    const it = d.pantry.find(i => String(i.ingredient_id) === b.dataset.cat);
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label">Category for “${esc(it.name)}”</span><button class="t-label grey" data-close>Cancel</button></div>
      <div class="pick-list">${order.map(c => `<button class="cat-pick t-item${c === it.category ? " active" : ""}" data-c="${esc(c)}">${icon(catIcon(c))}${esc(c)}</button>`).join("")}</div>`, "Pick a category");
    el.addEventListener("click", e => { const c = e.target.closest("[data-c]"); if (!c) return; close(); run(() => data.setCategory(it.ingredient_id, c.dataset.c)); });
  });
}
