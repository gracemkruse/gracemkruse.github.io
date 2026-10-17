import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, toast, sheet, amount } from "../ui.js";

// One-time import of the Notion export (made by tools/notion_to_kitchen.py).
// The file is picked from this device and never uploaded anywhere except your own database.
export async function importView(app) {
  app.innerHTML = `
    <section class="import">
      <div class="topline"><a class="btn-text grey t-label" href="#/recipes">${icon("back", true)} Recipes</a></div>
      <h1 class="t-page page-title">Import</h1>
      <p class="t-instr">Bring your recipes and pantry over from Notion. Pick the import file, check the preview, then import. Nothing is saved until you press Import.</p>
      <div class="toolbar">
        <label class="btn-text t-label">${icon("plus", true)} Choose import file<input type="file" accept=".json,application/json" data-file hidden></label>
        <span class="t-label grey" data-fname>notion-import.json</span>
      </div>
      <div data-out></div>
    </section>`;
  const out = $("[data-out]", app);
  $("[data-file]", app).onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    $("[data-fname]", app).textContent = file.name;
    let payload;
    try { payload = JSON.parse(await file.text()); if (payload.format !== "kitchen-import-v1" || !Array.isArray(payload.recipes)) throw new Error(); }
    catch { out.innerHTML = `<p class="t-label clay">That isn’t a Kitchen import file. Pick notion-import.json.</p>`; return; }
    preview(out, payload);
  };
}

async function preview(out, payload) {
  const have = new Set((await data.listRecipes()).map(r => r.title.trim().toLowerCase()));
  const R = payload.recipes, fresh = R.filter(r => !have.has(r.title.trim().toLowerCase()));
  const tags = [...new Set(R.flatMap(r => r.tags))].sort();
  const noIng = R.filter(r => !r.ingredients.length), noSteps = R.filter(r => !r.steps.length && !r.archived);
  const meta = r => [`${r.ingredients.length} ingredients`, `${r.steps.length} steps`, r.archived ? "archived" : ""].filter(Boolean).join(" · ");
  const fact = (k, v) => `<div class="fact"><div class="k t-label">${k}</div><div class="t-item">${v}</div></div>`;
  let filter = "all";

  out.innerHTML = `
    <div class="section-head"><span class="t-label">Preview</span><span class="t-label grey">nothing saved yet</span></div>
    <div class="import-facts">
      ${fact("Recipes", `${fresh.length} new`)}
      ${fact("Already here", `${R.length - fresh.length} skipped`)}
      ${fact("Archived", `${R.filter(r => r.archived).length} (“hide”)`)}
      ${fact("Pantry", `${payload.pantry.length} items`)}
    </div>
    <div class="section-head"><span class="t-label">Tags</span><span class="t-label grey">${tags.length}</span></div>
    <p class="t-label grey import-tags">${tags.map(esc).join(" · ")}</p>
    <div class="section-head"><span class="t-label">Recipes</span><span class="t-label grey">tap one to check it</span></div>
    <div class="chips filters">
      <button class="chip t-label" data-f="all" aria-pressed="true">All ${R.length}</button>
      <button class="chip t-label" data-f="noing" aria-pressed="false">No ingredients ${noIng.length}</button>
      <button class="chip t-label" data-f="nosteps" aria-pressed="false">No method ${noSteps.length}</button>
    </div>
    <div class="import-list"></div>
    <p class="t-label grey">Recipes without a method import fine — they just show ingredients, like in Notion. Every recipe starts at serves 4.</p>
    <div class="import-go">
      <button class="btn-primary t-label" data-go ${fresh.length ? "" : "disabled"}>Import ${fresh.length} recipes</button>
      <div class="progress" hidden><div class="bar"></div></div>
      <p class="t-label grey" data-status></p>
    </div>`;

  const list = $(".import-list", out);
  const paint = () => {
    const shown = filter === "noing" ? noIng : filter === "nosteps" ? noSteps : R;
    list.innerHTML = shown.map((r, i) => `<button class="pick-row" data-i="${R.indexOf(r)}"><span class="t-recipe">${esc(r.title)}</span><span class="meta t-label grey">${esc(meta(r))}${have.has(r.title.trim().toLowerCase()) ? " · already here" : ""}</span></button>`).join("") || `<p class="t-item grey">None.</p>`;
  };
  paint();
  out.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; out.querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b)); paint(); });
  list.onclick = e => {
    const b = e.target.closest("[data-i]"); if (!b) return; const r = R[+b.dataset.i];
    sheet(`
      <div class="sheet-head"><span class="t-label">${esc(r.tags.join(" · ") || "No tags")}</span><button class="t-label grey" data-close>Close</button></div>
      <h2 class="t-recipe" style="margin:8px 0 0">${esc(r.title)}</h2>
      <p class="t-label grey">${esc([r.total_minutes ? `${r.total_minutes} min` : "", host(r.source_url) || r.source_notes || ""].filter(Boolean).join(" · "))}</p>
      <div class="section-head"><span class="t-label">Ingredients</span></div>
      ${r.ingredients.map(g => `<div class="ing-row"><span class="qty t-item">${esc(amount(g.amount, g.unit))}</span><span class="name t-item">${esc(g.name.toLowerCase())}${g.prep ? `, ${esc(g.prep)}` : ""}</span><span></span></div>`).join("") || `<p class="t-item grey">None.</p>`}
      ${r.steps.length ? `<div class="section-head"><span class="t-label">Method</span></div><ol class="steps">${r.steps.map((s, n) => `<li><span class="n t-label">${String(n + 1).padStart(2, "0")}</span><span class="t-instr">${esc(s)}</span></li>`).join("")}</ol>` : ""}
      ${r.notes ? `<div class="section-head"><span class="t-label">Notes</span></div><p class="t-instr" style="white-space:pre-line">${esc(r.notes)}</p>` : ""}`, r.title);
  };

  $("[data-go]", out).onclick = async e => {
    const go = e.currentTarget, status = $("[data-status]", out), prog = $(".progress", out), bar = $(".bar", out);
    if (!confirm(`Import ${fresh.length} recipes and ${payload.pantry.length} pantry items?`)) return;
    go.disabled = true; prog.hidden = false;
    const leave = ev => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", leave);
    try {
      const res = await data.importAll(payload, p => {
        status.textContent = p.phase === "pantry" ? `Pantry ${p.done} of ${p.total}…` : `Recipes ${p.done} of ${p.total}… keep this page open`;
        bar.style.width = `${p.total ? Math.round((p.done / p.total) * 100) : 100}%`;
      });
      status.innerHTML = `Done: ${res.added} recipes added${res.skipped ? `, ${res.skipped} already here` : ""}, ${res.pantry} pantry items.${res.failed.length ? `<br><span class="clay">Couldn’t add: ${res.failed.map(esc).join(", ")}</span>` : ""}`;
      go.outerHTML = `<a class="btn-primary t-label" href="#/recipes">See your recipes</a>`;
      toast("Import finished.");
    } catch (err) { console.error(err); status.innerHTML = `<span class="clay">Stopped: ${esc(err.message || err)}. Run it again — finished recipes are skipped.</span>`; go.disabled = false; }
    window.removeEventListener("beforeunload", leave);
  };
}

const host = u => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };
