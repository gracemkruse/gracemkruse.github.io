import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, toast, minutes, amount, photoStyle } from "../ui.js";
import { pickDay } from "../pickers.js";

export async function detailView(id, app) {
  const r = await data.getRecipe(id);
  const made = r ? await data.timesMade(r.id) : 0;
  if (!r) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p><p><a class="btn-text" href="#/recipes">Back to recipes</a></p>`; return; }
  const status = s => s === "out" ? `<span class="t-label clay">Out</span>` : s === "low" ? `<span class="t-label grey">Low</span>` : "";
  let host = ""; try { host = r.source_url ? new URL(r.source_url).hostname.replace(/^www\./, "") : ""; } catch {}
  const facts = [
    ["serves", "Serves", r.servings],
    r.total_minutes ? ["time", "Time", minutes(r.total_minutes).replace("′", " min")] : null,
    ["made", "Made", made ? `${made}×` : "Not yet"],
    r.source_url ? ["source", "Source", `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(host || "Link")}</a>`, true] : r.source_notes ? ["source", "Source", esc(r.source_notes), true] : null,
  ].filter(Boolean);

  app.innerHTML = `
    <article class="detail">
      <div class="topline">
        <a class="btn-text grey t-label" href="#/recipes">${icon("back", true)} Recipes</a>
        <a class="btn-text grey t-label" href="#/recipe/${encodeURIComponent(r.id)}/edit">Edit</a>
      </div>
      ${r.tags.length ? `<div class="t-label grey">${r.tags.map(esc).join(" · ")}</div>` : ""}
      <h1 class="t-page page-title">${esc(r.title)}</h1>

      <div class="toolbar">
        <button class="btn-text t-label" data-act="week">${icon("plus", true)} Add to this week</button>
        <button class="btn-text ink t-label" data-act="cook">Start cooking ${icon("play", true)}</button>
      </div>

      <div class="split">
        <div class="facts">
          ${facts.map(([ic, k, v, html]) => `<div class="fact"><div class="k t-label">${icon(ic, true)} ${k}</div><div class="t-item">${html ? v : esc(v)}</div></div>`).join("")}
        </div>
        <div class="photo" style="${photoStyle(r)}" role="img" aria-label="${esc(r.title)}"></div>
      </div>

      <div class="section-head"><span class="t-label">Ingredients</span><span class="t-label grey">for ${esc(r.servings)}</span></div>
      ${r.ingredients.length ? r.ingredients.map(g => `
        <div class="ing-row">
          <span class="qty t-item">${esc(amount(g.amount, g.unit))}</span>
          <span class="name t-item">${esc(g.name.toLowerCase())}${g.prep ? `, ${esc(g.prep)}` : ""}</span>
          ${status(g.stock_status)}
        </div>`).join("") : `<p class="t-item grey">No ingredients yet.</p>`}

      ${r.steps.length ? `
        <div class="section-head"><span class="t-label">Method</span></div>
        <ol class="steps">${r.steps.map((s, i) => `<li><span class="n t-label">${String(i + 1).padStart(2, "0")}</span><span class="t-instr">${esc(s)}</span></li>`).join("")}</ol>` : ""}

      ${r.notes ? `<div class="section-head"><span class="t-label">Notes</span></div><p class="notes t-instr">${esc(r.notes)}</p>` : ""}

      <div class="danger-zone"><button class="btn-text grey t-label" data-act="archive">Archive this recipe</button>
        <p class="t-label grey" style="margin:8px 0 0">Archived recipes are hidden, never deleted.</p></div>
    </article>`;

  $('[data-act="week"]', app).onclick = () => pickDay(r);
  $('[data-act="cook"]', app).onclick = () => { location.hash = `#/recipe/${encodeURIComponent(r.id)}/cook`; };
  $('[data-act="archive"]', app).onclick = async () => {
    if (!confirm(`Archive “${r.title}”? It will be hidden from your recipes.`)) return;
    await data.archiveRecipe(r.id); toast("Archived."); location.hash = "#/recipes";
  };
}
