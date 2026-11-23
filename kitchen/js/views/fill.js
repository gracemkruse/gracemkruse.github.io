import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, $$, toast, sheet, amount, sourceName, isWebLink, notionNote, niceTitle } from "../ui.js";
import { slug } from "./import.js";

// Fill in missing recipes (B-48): recipes with no method or no ingredients are read from their
// source link (Link Import) or from photos of their pages (Quick Add), reviewed, then saved.
// Saving only fills what's empty. The readers can be swapped in tests.
export const readers = { link: url => data.recipeFromLink(url), photos: files => data.recipeFromPhotos(files) };

export async function fillView(app) {
  const all = (await data.listIncomplete()).map(r => isWebLink(r.source_url) ? r
    : { ...r, source_notes: [r.source_url ? notionNote(r.source_url) : "", r.source_notes].filter(Boolean).join(", ") || null, source_url: null });
  const results = new Map();   // id → { draft, message } | { error }
  const photos = new Map();    // id → [File]
  const extra = [];            // recipes that look complete but you picked a page photo for (their method gets replaced)
  const withLink = all.filter(r => r.source_url);

  const missing = r => r.replace ? "nothing, but a page photo was picked: its method replaces the current one (old text kept in Notes)" : [!r.hasIngredients ? "ingredients" : r.hasAmounts === false && "ingredient amounts", !r.hasSteps && "method"].filter(Boolean).join(" and ");
  const summary = d => { const n = d.ingredients.filter(g => g.name).length, s = d.steps.length; return `${n} ingredient${n === 1 ? "" : "s"} · ${s} step${s === 1 ? "" : "s"}`; };
  const row = r => {
    const res = results.get(r.id), pics = photos.get(r.id);
    const status = !res ? `<span class="t-label grey">${r.replace ? (r.skip ? "Already complete · left out" : "Included · the photo’s method will replace the current one") : `Missing ${missing(r)}`}</span>`
      : res.error ? `<span class="t-label clay">${esc(res.error)}</span>`
      : `<span class="t-label green">Found ${esc(summary(res.draft))}</span>${res.message ? `<span class="t-label grey"> · ${esc(res.message)}</span>` : ""}`;
    const ok = res && !res.error && (res.draft.steps.length || res.draft.ingredients.some(g => g.name));
    return `<div class="fill-row" data-id="${esc(r.id)}">
      ${ok ? `<button class="box${res.keep !== false ? " on" : ""}" data-keep="${esc(r.id)}" aria-pressed="${res.keep !== false}" aria-label="Save ${esc(r.title)}">${res.keep !== false ? icon("check", true) : ""}</button>` : `<span class="fill-spacer"></span>`}
      <div class="fill-main">
        <span class="t-recipe recipe-name">${esc(niceTitle(r.title))}</span>
        <span class="fill-meta">${status}</span>
        <span class="t-label grey">${r.source_url ? esc(sourceName(r.source_url)) : ""}${pics ? `${r.source_url ? " · " : ""}${pics.length} page photo${pics.length > 1 ? "s" : ""}` : ""}${!r.source_url && !pics && r.source_notes ? esc(r.source_notes) : ""}</span>
      </div>
      ${ok ? `<button class="btn-text t-label" data-preview="${esc(r.id)}">Preview</button>` : r.replace && !res ? `<button class="btn-text t-label" data-include="${esc(r.id)}">${r.skip ? "Include" : "Leave out"}</button>` : ""}
    </div>`;
  };

  const paint = () => {
    const pending = [...results.values()].filter(x => !x.error && x.keep !== false && x.draft).length;
    const photoRows = all.filter(r => photos.has(r.id));
    const toRead = photoRows.filter(r => !r.skip && !results.has(r.id));   // complete recipes stay out unless you include them
    const linkRows = withLink.filter(r => !photos.has(r.id));
    const rest = all.filter(r => !r.source_url && !photos.has(r.id));
    app.innerHTML = `
      <section class="fill">
        <div class="topline"><a class="btn-text grey t-label" href="#/import">${icon("back", true)} Import</a></div>
        <h1 class="t-page page-title">Fill in missing recipes</h1>
        <p class="t-instr">${all.length} recipes are missing a method, ingredients or ingredient amounts. Read them from their links or from photos of their pages, check what was found, then save. Only the empty parts are filled; titles, photos and anything already there stay as they are.</p>

        <div class="section-head"><span class="t-label">From links</span><span class="t-label grey">${linkRows.length} · free</span></div>
        <div class="fill-list">${linkRows.map(row).join("") || `<p class="t-item grey">None.</p>`}</div>
        ${linkRows.length ? `<button class="btn-text t-label fill-go" data-read="links">${icon("link", true)} Read ${linkRows.length} links</button>` : ""}

        <div class="section-head"><span class="t-label">From page photos</span><span class="t-label grey">about 6¢ a photo</span></div>
        <p class="t-label grey">Pick the photos in <span class="t-item">kitchen-docs/notion-recipe-pages</span> (Cmd + A). They're matched to recipes by name.</p>
        <label class="btn-text t-label fill-go">${icon("plus", true)} Choose page photos<input type="file" accept="image/*" multiple data-pages hidden></label>
        <div class="fill-list">${photoRows.map(row).join("")}</div>
        ${toRead.length ? `<button class="btn-text t-label fill-go" data-read="photos">${icon("link", true)} Read ${toRead.length} recipes from ${toRead.reduce((n, r) => n + photos.get(r.id).length, 0)} photos</button>` : ""}

        <div class="section-head"><span class="t-label">Nothing to read</span><span class="t-label grey">${rest.length}</span></div>
        <p class="t-label grey">No link or page photo. Open one and use Edit, or take a photo of the page with New recipe → Take or choose a photo.</p>
        <details class="fill-rest"><summary class="t-label">Show ${rest.length}</summary>${rest.map(r => `<a class="fill-rest-row t-item recipe-name" href="#/recipe/${encodeURIComponent(r.id)}">${esc(niceTitle(r.title))}</a>`).join("")}</details>

        <div class="fill-foot">
          <button class="btn-primary t-label" data-save ${pending ? "" : "disabled"}>Save ${pending} recipe${pending === 1 ? "" : "s"}</button>
          <span class="t-label grey" data-status></span>
        </div>
      </section>`;
    wire();
  };

  const status = t => { const el = $("[data-status]", app); if (el) el.textContent = t; };
  const readAll = async (list, read, label) => {
    $$("[data-read], [data-save]", app).forEach(b => (b.disabled = true));
    let n = 0;
    for (const r of list) {
      status(`${label} ${++n} of ${list.length}: ${r.title}…`);
      try { const res = await read(r); results.set(r.id, { draft: res.draft, message: res.message || "" }); }
      catch (e) { results.set(r.id, { error: e.message || "Couldn’t read it." }); }
      paint(); status(`${label} ${n} of ${list.length}…`);
    }
    const found = list.filter(r => !results.get(r.id)?.error).length;
    status(`Done: found ${found} of ${list.length}. Check them, then save.`);
  };

  function wire() {
    const link = $('[data-read="links"]', app);
    if (link) link.onclick = () => readAll(withLink.filter(r => !photos.has(r.id)), r => readers.link(r.source_url), "Reading link");
    const pics = $('[data-read="photos"]', app);
    if (pics) pics.onclick = () => readAll(all.filter(r => photos.has(r.id) && !r.skip && !results.has(r.id)), r => readers.photos(photos.get(r.id)), "Reading");
    $$("[data-include]", app).forEach(b => b.onclick = () => { const r = all.find(x => x.id === b.dataset.include); r.skip = !r.skip; paint(); });
    $("[data-pages]", app).onchange = async e => {
      const files = [...e.target.files];
      const known = new Set(all.map(r => r.id));
      for (const r of await data.listRecipes()) if (!known.has(r.id)) extra.push({ id: r.id, title: r.title, source_url: null, source_notes: null, hasSteps: true, hasIngredients: true, replace: true, skip: true });
      const pool = [...all, ...extra];
      const bySlug = new Map(pool.map(r => [slug(r.title), r]));
      const unmatched = [];
      for (const f of files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
        const r = bySlug.get(slug(f.name.replace(/\.[^.]+$/, "").replace(/--\d+$/, "")));
        if (!r) { unmatched.push(f.name); continue; }
        photos.set(r.id, [...(photos.get(r.id) || []), f].slice(0, 3));
        if (!all.includes(r)) all.push(r);
      }
      paint();
      if (unmatched.length) toast(`No recipe found for ${unmatched.length} photo${unmatched.length > 1 ? "s" : ""}.`);
    };
    $$("[data-keep]", app).forEach(b => b.onclick = () => { const r = results.get(b.dataset.keep); r.keep = r.keep === false; paint(); });
    $$("[data-preview]", app).forEach(b => b.onclick = () => {
      const r = all.find(x => x.id === b.dataset.preview), d = results.get(r.id).draft;
      sheet(`
        <div class="sheet-head"><span class="t-label">What was found</span><button class="t-label grey" data-close>Close</button></div>
        <h2 class="t-recipe recipe-name" style="margin:8px 0 0">${esc(niceTitle(r.title))}</h2>
        <p class="t-label grey">Only the parts this recipe is missing will be saved (${esc(missing(r))}).</p>
        <div class="section-head"><span class="t-label">Ingredients</span></div>
        ${d.ingredients.filter(g => g.name).map(g => `<div class="ing-row"><span class="qty t-item">${esc(amount(g.amount, g.unit))}</span><span class="name t-item">${esc(g.name.toLowerCase())}${g.prep ? `, ${esc(g.prep)}` : ""}</span><span></span></div>`).join("") || `<p class="t-item grey">None found.</p>`}
        ${d.steps.length ? `<div class="section-head"><span class="t-label">Method</span></div><ol class="steps">${d.steps.map((s, n) => `<li><span class="n t-label">${String(n + 1).padStart(2, "0")}</span><span class="t-instr">${esc(s)}</span></li>`).join("")}</ol>` : ""}`, r.title);
    });
    const save = $("[data-save]", app);
    if (save) save.onclick = async () => {
      const todo = all.filter(r => { const x = results.get(r.id); return x && !x.error && x.keep !== false && x.draft; });
      save.disabled = true; let n = 0; const failed = [];
      for (const r of todo) {
        status(`Saving ${++n} of ${todo.length}…`);
        try { await data.fillRecipe(r.id, results.get(r.id).draft, { replaceSteps: !!r.replace }); results.delete(r.id); }
        catch (e) { console.error(e); failed.push(r.title); }
      }
      toast(`Saved ${todo.length - failed.length} recipe${todo.length - failed.length === 1 ? "" : "s"}.`);
      if (failed.length) toast(`Couldn’t save: ${failed.join(", ")}`);
      fillView(app);
    };
  }

  paint();
}
