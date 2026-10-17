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
      <div class="section-head"><span class="t-label">Photos</span><span class="t-label grey">after the recipes are in</span></div>
      <p class="t-instr">Pick all the photos in <span class="t-item">kitchen-docs/notion-photos</span> (Cmd + A in the picker). Each one is matched to its recipe by name.</p>
      <div class="toolbar">
        <label class="btn-text t-label">${icon("plus", true)} Choose photos<input type="file" accept="image/*" multiple data-photos hidden></label>
        <span class="t-label grey" data-pcount></span>
      </div>
      <div data-pout></div>
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
  $("[data-photos]", app).onchange = e => { const files = [...e.target.files]; if (files.length) photoStep($("[data-pout]", app), files, $("[data-pcount]", app)); };
}

// ---------- Photos: match files to recipes by name, review, upload ----------
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");   // same as tools/notion_photos.py

async function photoStep(out, files, countEl) {
  const recipes = await data.listRecipes();
  const bySlug = new Map(recipes.map(r => [slug(r.title), r]));
  const items = files.map(f => ({ f, r: bySlug.get(slug(f.name.replace(/\.[^.]+$/, ""))) }));
  const matched = items.filter(x => x.r), unmatched = items.filter(x => !x.r);
  for (const x of matched) x.on = !x.r.image_url;            // recipes that already have a photo are skipped
  countEl.textContent = `${files.length} chosen`;
  out.innerHTML = `
    <p class="t-label grey">${matched.length} match a recipe${unmatched.length ? ` · ${unmatched.length} don’t` : ""} · tap a photo to skip it</p>
    <div class="photo-grid">${matched.map((x, i) => `
      <button class="pg${x.on ? "" : " off"}" data-p="${i}" aria-pressed="${x.on}">
        <span class="pg-img" style="background-image:url('${URL.createObjectURL(x.f)}')"></span>
        <span class="t-label pg-t">${esc(x.r.title)}</span>
        ${x.r.image_url ? `<span class="t-label grey">has a photo</span>` : ""}
      </button>`).join("")}</div>
    ${unmatched.length ? `<p class="t-label grey">No recipe found for: ${unmatched.map(x => esc(x.f.name)).join(", ")}</p>` : ""}
    <div class="import-go">
      <button class="btn-primary t-label" data-up></button>
      <div class="progress" hidden><div class="bar"></div></div>
      <p class="t-label grey" data-pstatus></p>
    </div>`;
  const btn = $("[data-up]", out);
  const label = () => { const n = matched.filter(x => x.on).length; btn.textContent = `Upload ${n} photo${n === 1 ? "" : "s"}`; btn.disabled = !n; };
  $(".photo-grid", out).onclick = e => { const b = e.target.closest("[data-p]"); if (!b) return; const x = matched[+b.dataset.p]; x.on = !x.on; b.classList.toggle("off", !x.on); b.setAttribute("aria-pressed", x.on); label(); };
  label();
  btn.onclick = async () => {
    const todo = matched.filter(x => x.on); btn.disabled = true;
    const st = $("[data-pstatus]", out), prog = $(".progress", out), bar = $(".bar", out); prog.hidden = false;
    const leave = ev => { ev.preventDefault(); ev.returnValue = ""; }; window.addEventListener("beforeunload", leave);
    let done = 0; const failed = [];
    const work = async x => {
      try { await data.setRecipePhoto(x.r.id, await data.uploadPhoto(x.f)); x.on = false; }
      catch (err) { console.error(x.r.title, err); failed.push(x.r.title); }
      done++; st.textContent = `Uploading ${done} of ${todo.length}… keep this page open`; bar.style.width = `${Math.round((done / todo.length) * 100)}%`;
    };
    for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(work));   // three at a time
    window.removeEventListener("beforeunload", leave);
    st.innerHTML = `Done: ${todo.length - failed.length} photos added.${failed.length ? `<br><span class="clay">Couldn’t add: ${failed.map(esc).join(", ")} — try those again.</span>` : ""}`;
    btn.outerHTML = `<a class="btn-primary t-label" href="#/recipes">See your recipes</a>`;
    toast("Photos added.");
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
