import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, $$, toast, minutes, amount, photoStyle, sourceName, isWebLink, notionNote, niceTitle } from "../ui.js";
import { pickDay, pickStatus } from "../pickers.js";
import { directShare } from "./share.js";

// Recipe page. Phone: one column (photo + facts, ingredients, method).
// iPad and desktop: ingredients stay on the left while the method scrolls on the right.
// Tap a step to check it off; it dims.
export async function detailView(id, app) {
  const r = await data.getRecipe(id);
  const made = r ? await data.timesMade(r.id) : 0;
  if (!r) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p><p><a class="btn-text" href="#/recipes">Back to recipes</a></p>`; return; }
  // stock status is tappable: Out / Low / In stock, or a dash when not tracked
  const STATUS = { out: ["Out", "clay"], low: ["Low", "grey"], in_stock: ["In stock", "green"], not_tracked: ["—", "grey"] };
  const status = g => { const [l, c] = STATUS[g.stock_status] || STATUS.not_tracked;
    return g.ingredient_id ? `<button class="stock t-label ${c}" data-ing="${esc(g.ingredient_id)}" data-now="${esc(g.stock_status)}" aria-label="${esc(g.name)}: ${l === "—" ? "not tracked" : l}. Change">${l}</button>` : ""; };
  const link = isWebLink(r.source_url) ? r.source_url : null;
  const host = link ? sourceName(link) : "";
  const bookNote = [link || !r.source_url ? "" : notionNote(r.source_url), r.source_notes].filter(Boolean).join(", ");
  const facts = [
    r.servings ? ["serves", "Serves", r.servings] : null,
    r.total_minutes ? ["time", "Time", minutes(r.total_minutes).replace("′", " min")] : null,
    ["made", "Made", made ? `${made}×` : "Not yet"],
    link ? ["source", "Source", `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(host || "Link")}</a>`, true] : bookNote ? ["source", "Source", esc(bookNote), true] : null,
  ].filter(Boolean);
  const done = doneSteps(r.id);

  app.innerHTML = `
    <article class="detail">
      <div class="topline">
        <a class="btn-text grey t-label" href="#/recipes">${icon("back", true)} Recipes</a>
        <span class="topline-actions">
          <button class="btn-text grey t-label" data-act="share">Share</button>
          <a class="btn-text grey t-label" href="#/recipe/${encodeURIComponent(r.id)}/edit">Edit</a>
        </span>
      </div>
      <h1 class="t-page page-title recipe-name">${esc(niceTitle(r.title))}</h1>
      <div class="toolbar">
        <button class="btn-text t-label" data-act="week">${icon("plus", true)} Add to this week</button>
        ${r.tags.length ? `<span class="detail-tags t-label grey">${r.tags.map(esc).join(" · ")}</span>` : ""}
      </div>

      <div class="detail-body">
        <div class="detail-hero">
          <button class="photo" style="${photoStyle(r)}" aria-label="${esc(r.title)}: enlarge photo" ${r.image_url ? "" : "disabled"}></button>
          <div class="facts">
            ${facts.map(([ic, k, v, html]) => `<div class="fact"><div class="k t-label">${icon(ic, true)} ${k}</div><div class="t-item">${html ? v : esc(v)}</div></div>`).join("")}
          </div>
        </div>

        <aside class="detail-ings" aria-label="Ingredients">
          <div class="section-head"><span class="t-label">Ingredients</span>${r.servings ? `<span class="t-label grey">for ${esc(r.servings)}</span>` : ""}</div>
          ${r.ingredients.length ? r.ingredients.map(g => `
            <div class="ing-row">
              <span class="qty t-ing">${esc(amount(g.amount, g.unit))}</span>
              <span class="name t-ing">${esc(g.name.toLowerCase())}${g.prep ? `, ${esc(g.prep)}` : ""}</span>
              ${status(g)}
            </div>`).join("") : `<p class="t-ing grey">No ingredients yet.</p>`}
        </aside>

        <section class="detail-method">
          ${r.steps.length || r.notes ? `<div class="section-head"><span class="t-label">Method</span>${r.steps.length ? `<span class="t-label grey" data-progress>${progress(done, r.steps.length)}</span>` : ""}</div>` : ""}
          ${r.notes ? `<p class="notes t-instr">${esc(r.notes)}</p>` : ""}
          ${r.steps.length ? `<ol class="steps">${r.steps.map((s, i) => `<li><button class="step${done.has(i) ? " done" : ""}" data-step="${i}" aria-pressed="${done.has(i)}"><span class="n t-label">${String(i + 1).padStart(2, "0")}</span><span class="t-instr">${esc(s)}</span></button></li>`).join("")}</ol>` : ""}
          <div class="danger-zone"><button class="btn-text grey t-label" data-act="archive">Archive</button><button class="btn-text grey t-label" data-act="delete">Delete</button></div>
        </section>
      </div>
    </article>`;

  $('[data-act="week"]', app).onclick = () => pickDay(r);
  // tap a step to check it off (it dims); remembered until the tab is closed
  $$("[data-step]", app).forEach(b => b.onclick = () => {
    const i = +b.dataset.step; done.has(i) ? done.delete(i) : done.add(i);
    b.classList.toggle("done", done.has(i)); b.setAttribute("aria-pressed", done.has(i)); saveDone(r.id, done);
    const p = $("[data-progress]", app); if (p) p.textContent = progress(done, r.steps.length);
  });
  // tap a status → choose a new one in place
  $$(".stock", app).forEach(b => b.onclick = async () => {
    const next = await pickStatus(b, b.dataset.now); if (!next) return;
    try { await data.setStock(b.dataset.ing, next); const [l, c] = STATUS[next]; b.textContent = l; b.className = `stock t-label ${c}`; b.dataset.now = next; }
    catch (e) { console.error(e); toast("Couldn’t update — try again."); }
  });
  // tap the photo → full screen; pinch to zoom on phones
  const photo = $(".detail-hero .photo", app);
  if (photo && r.image_url) photo.onclick = () => {
    const box = document.createElement("div");
    box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", r.title);
    box.innerHTML = `<img src="${esc(r.image_url)}" alt="${esc(r.title)}"><button class="lightbox-close grey" aria-label="Close">${icon("close")}</button>`;
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    box.onclick = e => { if (e.target === box || e.target.closest(".lightbox-close")) close(); };
    document.addEventListener("keydown", onKey); document.body.appendChild(box);
  };
  directShare(r, $('[data-act="share"]', app));
  $('[data-act="archive"]', app).onclick = async () => {
    if (!confirm(`Archive “${niceTitle(r.title)}”? It will be hidden from your recipes.`)) return;
    await data.archiveRecipe(r.id); toast("Archived."); location.hash = "#/recipes";
  };
  $('[data-act="delete"]', app).onclick = async () => {
    if (!confirm(`Delete “${niceTitle(r.title)}” for good? This can’t be undone.`)) return;
    try { await data.deleteRecipe(r.id); toast("Deleted."); location.hash = "#/recipes"; }
    catch (e) { console.error(e); toast("Couldn’t delete. Try again."); }
  };
}

// Checked-off steps per recipe, kept until the tab is closed.
const progress = (done, n) => (done.size ? `${done.size} of ${n} done` : `${n} steps`);
function doneSteps(id) { try { return new Set(JSON.parse(sessionStorage.getItem("kitchen-steps-" + id) || "[]")); } catch { return new Set(); } }
function saveDone(id, set) { try { sessionStorage.setItem("kitchen-steps-" + id, JSON.stringify([...set])); } catch {} }
