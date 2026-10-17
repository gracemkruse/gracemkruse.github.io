import * as data from "../data.js";
import { icon, tagIcon, densityGlyph } from "../icons.js";
import { esc, $, $$, minutes, photoStyle, pref } from "../ui.js";

// Gallery state survives navigation within the session.
const state = { tag: "All", q: "", searching: false };

export async function galleryView(app) {
  const [recipes, tags] = await Promise.all([data.listRecipes(), data.listTags()]);
  let view = Number(pref.get("view", "2")); if (![1, 2, 4].includes(view)) view = 2;

  function paint() {
    const q = state.q.trim().toLowerCase();
    const shown = recipes.filter(r => (state.tag === "All" || r.tags.includes(state.tag)) && (!q || r.title.toLowerCase().includes(q)));
    const title = state.tag === "All" ? "Recipes" : state.tag;
    app.innerHTML = `
      <div class="gallery">
        <aside class="sidebar" aria-label="Tags">
          <button class="search-toggle" aria-label="Search recipes" aria-expanded="${state.searching}">${icon("search")}</button>
          ${["All", ...tags].map(t => `<button class="tag-v t-label${t === state.tag ? " active" : ""}" data-tag="${esc(t)}" aria-pressed="${t === state.tag}">${esc(t)}</button>`).join("")}
        </aside>
        <section class="gallery-main">
          <div class="gallery-head">
            <span class="t-label grey">Kitchen — ${shown.length}</span>
            <div class="view-switch" role="group" aria-label="Recipes per row">
              ${[1, 2, 4].map(n => `<button data-view="${n}" aria-pressed="${n === view}" aria-label="${n} per row">${densityGlyph(n, n === view)}</button>`).join("")}
            </div>
          </div>
          <h1 class="t-page page-title" style="margin-top:12px">${esc(title)}</h1>
          ${state.searching ? `<label class="input-line search-line">${icon("search", false, "grey")}<input class="t-item" type="search" placeholder="Search ${recipes.length} recipes" value="${esc(state.q)}"></label>` : ""}
          ${shown.length ? `<div class="cards v${view}">${shown.map(r => card(r, view)).join("")}</div>`
                         : `<p class="empty t-item">${recipes.length ? "Nothing matches — try another tag or search." : "No recipes yet. Add your first with the + button."}</p>`}
        </section>
      </div>
      <a class="fab" href="#/add" aria-label="Add a recipe">${icon("plus")}</a>`;

    $$(".tag-v", app).forEach(b => b.onclick = () => { state.tag = b.dataset.tag; paint(); });
    $$(".view-switch button", app).forEach(b => b.onclick = () => { view = Number(b.dataset.view); pref.set("view", String(view)); paint(); });
    $(".search-toggle", app).onclick = () => { state.searching = !state.searching; if (!state.searching) state.q = ""; paint(); if (state.searching) $(".search-line input", app)?.focus(); };
    const input = $(".search-line input", app);
    if (input) input.oninput = () => { state.q = input.value; const pos = input.selectionStart; paint(); const again = $(".search-line input", app); again.focus(); again.setSelectionRange(pos, pos); };
  }

  function card(r, v) {
    const ic = tagIcon(r.tags);
    const meta = [r.tags[0], minutes(r.total_minutes)].filter(Boolean).join(" · ");
    return `<a class="card" href="#/recipe/${encodeURIComponent(r.id)}">
      <div class="photo" style="${photoStyle(r)}" role="img" aria-label="${esc(r.title)}"></div>
      ${v === 4 ? `<span class="name t-label">${esc(r.title)}</span>`
               : `<span class="name t-recipe">${esc(r.title)}</span>${meta ? `<span class="meta t-label">${ic ? icon(ic, true) : ""}${esc(meta)}</span>` : ""}`}
    </a>`;
  }

  paint();
}
