import * as data from "../data.js";
import { icon, whiskIcon } from "../icons.js";
import { esc, $, $$, toast, photoStyle, niceTitle, isWebLink, amount, sheet, sentence } from "../ui.js";
import { parseIngredient, parseRecipeText } from "../parse.js";

// Add and edit a recipe. Only the name is required.
// Top: the name, then two ways to fill the form: paste a link or the whole recipe as text, or a photo of a recipe.
// Then the dish photo, serves / time / source, ingredients (one per line), method, notes, tags. Save stays on screen.
// A new recipe in progress is kept in this browser until it's saved or cancelled (B-49).
const DRAFT = "kitchen-draft-new";

export async function editView(id, app, draft = null) {
  const existing = id ? await data.getRecipe(id) : null;
  if (id && !existing) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p>`; return; }
  const allTags = await data.listTags();
  let restored = false;
  if (!id && !draft) { const saved = loadDraft(); if (saved) { draft = saved; restored = true; } }
  // Editing and filling from a link, text or photo: what was found replaces those parts; tags and anything not found stay.
  const found = (k, v) => k !== "tags" && k !== "id" && (Array.isArray(v) ? (k === "ingredients" ? v.some(g => g && g.name) : v.length > 0) : v !== "" && v != null);
  const r = existing && draft ? { ...existing, ...Object.fromEntries(Object.entries(draft).filter(([k, v]) => found(k, v))) }
    : existing || draft || { title: "", servings: "", total_minutes: "", image_url: "", tags: [], ingredients: [], steps: [], notes: "", source_url: "", source_notes: "" };
  const selected = new Set(r.tags || []);
  const ingText = (r.ingredients || []).filter(g => g && g.name).map(g => [amount(g.amount, g.unit), sentence(g.name) + (g.prep ? `, ${g.prep}` : "")].filter(Boolean).join(" ")).join("\n");
  const back = id ? `#/recipe/${encodeURIComponent(id)}` : "#/recipes";

  app.innerHTML = `
    <form class="form" novalidate>
      <div class="topline"><a class="btn-text grey t-label" href="${back}">${icon("back", true)} ${id ? "Recipe" : "Recipes"}</a></div>
      <textarea class="t-page title-input" name="title" rows="1" required placeholder="Recipe name" aria-label="Recipe name">${esc(niceTitle(r.title))}</textarea>

      <div class="fill-from">
        <label class="fill-part">
          <span class="t-label">${icon("link", true)} Paste a link</span>
          <input class="t-item" type="url" name="link" inputmode="url" autocomplete="off" placeholder="https://…" value="${esc(draft?.source_url && isWebLink(draft.source_url) ? draft.source_url : (id && isWebLink(r.source_url) ? r.source_url : ""))}">
        </label>
        <label class="fill-part">
          <span class="t-label">${icon("plus", true)} Recipe photo</span>
          <span class="t-item grey">Up to 3 pages</span>
          <input type="file" accept="image/*" multiple data-recipe-photos hidden>
        </label>
      </div>
      <p class="t-label clay" data-fill-status hidden></p>

      <div class="section-head own-head"><span class="t-label">${id ? "Recipe" : "Or write your own"}</span></div>

      <div class="field">
        <span class="t-label">Photo</span>
        <div class="photo-pick">
          <div class="photo-preview" style="${photoStyle({ ...r, id: id || "new" })}"></div>
          <div class="photo-actions">
            <label class="btn-text t-label">${icon("plus", true)} <span data-pick-label>${r.image_url ? "Change photo" : "Add photo"}</span><input type="file" accept="image/*" data-file hidden></label>
            <button type="button" class="btn-text grey t-label" data-act="rm-photo" ${r.image_url ? "" : "hidden"}>Remove photo</button>
            <span class="t-label grey">or paste a photo</span>
            <span class="hint t-label" data-photo-status></span>
          </div>
        </div>
      </div>

      <div class="two">
        <label class="field"><span class="t-label">Serves</span><input class="t-item" name="servings" inputmode="numeric" value="${esc(r.servings ?? "")}" placeholder="4"></label>
        <label class="field"><span class="t-label">Time in minutes</span><input class="t-item" name="total_minutes" inputmode="numeric" value="${esc(r.total_minutes ?? "")}" placeholder="45"></label>
      </div>
      <div class="two">
        <label class="field"><span class="t-label">Source link</span><input class="t-item" name="source_url" value="${esc(r.source_url ?? "")}" placeholder="https://…"></label>
        <label class="field"><span class="t-label">Source notes</span><input class="t-item" name="source_notes" value="${esc(r.source_notes ?? "")}" placeholder="Grandma’s card"></label>
      </div>

      <label class="field"><span class="t-label">Ingredients · one per line</span><textarea class="t-item" name="ingredients" placeholder="2 tsp cumin&#10;1 lb chicken thighs, boneless">${esc(ingText)}</textarea></label>
      <label class="field"><span class="t-label">Method · one step per line</span><textarea class="t-instr" name="steps" placeholder="Warm the oil in a heavy pot…">${esc((r.steps || []).join("\n"))}</textarea></label>
      <label class="field"><span class="t-label">Description</span><textarea class="t-instr" name="notes" style="min-height:96px" placeholder="Double the garlic.">${esc(r.notes ?? "")}</textarea></label>

      <div class="field">
        <span class="tags-head"><span class="t-label">Tags</span><button type="button" class="btn-text grey t-label" data-act="edit-tags" aria-pressed="false">Edit tags</button></span>
        <div class="chips">${[...new Set([...allTags, ...selected])].map(t => `<button type="button" class="chip t-label" data-tag="${esc(t)}" aria-pressed="${selected.has(t)}">${esc(t)}</button>`).join("")}</div>
        <label class="input-line">${icon("plus", false, "green")}<input class="t-item" name="newtag" placeholder="New tag, then Enter"></label>
      </div>

      <div class="form-actions">
        <span class="error t-label clay" aria-live="assertive"></span>
        <a class="btn-text grey t-label" href="${back}" data-act="cancel">Cancel</a>
        <button class="btn-primary t-label" type="submit">Save recipe</button>
      </div>
    </form>`;

  const form = $(".form", app), F = form.elements, chips = $(".chips", app);
  const fillStatus = $("[data-fill-status]", app);
  const say = (el, msg) => { el.textContent = msg; el.hidden = !msg; };

  // the name wraps and grows like a heading; Enter doesn't add a line
  const grow = el => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  F.title.addEventListener("input", () => { F.title.value = F.title.value.replace(/\n/g, " "); grow(F.title); });
  F.title.addEventListener("keydown", e => { if (e.key === "Enter") e.preventDefault(); });
  grow(F.title); requestAnimationFrame(() => grow(F.title)); document.fonts.ready.then(() => grow(F.title));

  // tags
  let editingTags = false;
  const wireChip = c => c.onclick = () => {
    if (editingTags) return editTag(c);
    const t = c.dataset.tag; selected.has(t) ? selected.delete(t) : selected.add(t); c.setAttribute("aria-pressed", selected.has(t)); keep();
  };
  const tagBtn = $('[data-act="edit-tags"]', app);
  tagBtn.onclick = () => { editingTags = !editingTags; chips.classList.toggle("editing", editingTags); tagBtn.textContent = editingTags ? "Done" : "Edit tags"; tagBtn.setAttribute("aria-pressed", editingTags); };
  // rename or delete a tag on every recipe (saved right away, not with the recipe)
  function editTag(c) {
    const name = c.dataset.tag;
    const { el, close } = sheet(`
      <div class="sheet-head"><span class="t-label">Edit tag</span><button type="button" class="t-label grey" data-close>Cancel</button></div>
      <label class="input-line"><input class="t-item" name="tagname" value="${esc(name)}" aria-label="Tag name"></label>
      <p class="t-label grey">Changes this tag on every recipe.</p>
      <div class="tile-actions"><button type="button" class="btn-text t-label" data-act="rename">Rename</button><button type="button" class="btn-text grey t-label" data-act="delete">Delete tag</button></div>`, "Edit tag");
    const input = el.querySelector("input"); input.focus(); input.select();
    const rename = async () => {
      const to = input.value.trim(); if (!to || to === name) { close(); return; }
      try {
        await data.renameTag(name, to); close();
        const twin = [...$$(".chip", chips)].find(x => x !== c && x.dataset.tag.toLowerCase() === to.toLowerCase());
        const on = selected.has(name) || (twin && selected.has(twin.dataset.tag)); selected.delete(name);
        if (twin) { c.remove(); if (on) { selected.add(twin.dataset.tag); twin.setAttribute("aria-pressed", "true"); } }
        else { c.dataset.tag = to; c.textContent = to; if (on) selected.add(to); }
        keep(); toast(`Renamed to “${to}”.`);
      } catch (e) { console.error(e); toast("Couldn’t rename. Try again."); }
    };
    el.querySelector('[data-act="rename"]').onclick = rename;
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); rename(); } });
    el.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm(`Delete the tag “${name}”? It comes off every recipe; the recipes stay.`)) return;
      try { await data.deleteTag(name); close(); selected.delete(name); c.remove(); keep(); toast("Tag deleted."); }
      catch (e) { console.error(e); toast("Couldn’t delete. Try again."); }
    };
  }
  $$(".chip", chips).forEach(wireChip);
  F.newtag.addEventListener("keydown", e => {
    if (e.key !== "Enter") return; e.preventDefault();
    const t = F.newtag.value.trim(); if (!t) return;
    const known = [...selected, ...allTags].find(x => x.toLowerCase() === t.toLowerCase());
    if (!known) { chips.insertAdjacentHTML("beforeend", `<button type="button" class="chip t-label" data-tag="${esc(t)}" aria-pressed="true">${esc(t)}</button>`); wireChip(chips.lastElementChild); selected.add(t); }
    else { selected.add(known); const c = [...$$(".chip", chips)].find(x => x.dataset.tag === known); if (c) c.setAttribute("aria-pressed", "true"); }
    F.newtag.value = ""; keep();
  });

  // ---- dish photo: upload right away so Save stays quick; pasting a photo anywhere on the page sets it (B-74) ----
  let photo = r.image_url || "", uploading = false;
  const preview = $(".photo-preview", app), photoStatus = $("[data-photo-status]", app), rm = $('[data-act="rm-photo"]', app);
  const showPhoto = () => { if (photo) preview.style.backgroundImage = `url("${photo.replace(/["\\]/g, encodeURIComponent)}")`; else preview.setAttribute("style", photoStyle({ id: id || "new", title: F.title.value })); rm.hidden = !photo; $("[data-pick-label]", app).textContent = photo ? "Change photo" : "Add photo"; };
  const usePhoto = async file => {
    uploading = true; photoStatus.textContent = "Uploading…"; photoStatus.classList.remove("clay");
    try { photo = await data.uploadPhoto(file); photoStatus.textContent = ""; showPhoto(); keep(); }
    catch (ex) { console.error(ex); photoStatus.textContent = ex.message || "Couldn’t upload. Try again."; photoStatus.classList.add("clay"); }
    uploading = false;
  };
  $("[data-file]", app).onchange = e => { const file = e.target.files[0]; e.target.value = ""; if (file) usePhoto(file); };
  rm.onclick = () => { photo = ""; showPhoto(); keep(); };
  const onPaste = e => {
    if (!document.body.contains(form)) { document.removeEventListener("paste", onPaste); return; }
    const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); usePhoto(file); }
  };
  document.addEventListener("paste", onPaste);

  // ---- fill from a link, pasted text or a photo of a recipe (dims the screen with a whisk while it reads) ----
  const refill = async d => { clearDraft(); await editView(id, app, d); toast(id ? "Filled in. Check it over, then save." : "Filled in. Check it over, then save."); };
  const readLink = async url => {
    say(fillStatus, "");
    const done = busy("Reading the recipe…");
    try { const { draft: d, message } = await data.recipeFromLink(url); done(); await refill(d); if (message) toast(message); }
    catch (err) { done(); console.error(err); say(fillStatus, err.message || "Couldn’t read that link."); }
  };
  // pasting a link is enough: it's read right away (B-83)
  F.link.addEventListener("paste", e => {
    const text = (e.clipboardData?.getData("text") || "").trim();
    if (!/^https?:\/\/\S+$/i.test(text)) return;
    e.preventDefault(); F.link.value = text; readLink(text);
  });
  // a whole recipe pasted into Ingredients or Method is split into both (and the name, if it's empty) (B-38)
  for (const box of [F.ingredients, F.steps]) box.addEventListener("paste", e => {
    const text = e.clipboardData?.getData("text") || "";
    const t = parseRecipeText(text);
    if (!(t.ingredients.length && t.steps.length) || text.split("\n").length < 4) return;
    e.preventDefault();
    if (!F.title.value.trim() && t.title) { F.title.value = t.title; grow(F.title); }
    F.ingredients.value = t.ingredients.map(parseIngredient).filter(Boolean).map(g => [amount(g.amount, g.unit), sentence(g.name) + (g.prep ? `, ${g.prep}` : "")].filter(Boolean).join(" ")).join("\n");
    F.steps.value = t.steps.join("\n");
    keep(); toast("Split into ingredients and method. Check it over, then save.");
  });
  F.link.addEventListener("keydown", e => {
    if (e.key !== "Enter") return; e.preventDefault();
    const v = F.link.value.trim(); if (!v) return;
    if (/^https?:\/\//i.test(v)) readLink(v); else say(fillStatus, "Paste the full link, starting with https://");
  });
  $("[data-recipe-photos]", app).onchange = async e => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    say(fillStatus, "");
    const done = busy(`Reading ${files.length > 1 ? `${files.length} pages` : "the recipe"}… about half a minute`);
    try { const { draft: d } = await data.recipeFromPhotos(files); done(); await refill(d); }
    catch (err) { done(); console.error(err); say(fillStatus, err.message || "Couldn’t read that photo."); }
  };

  // ---- the recipe as typed so far ----
  const current = () => ({
    id, title: F.title.value, servings: F.servings.value, total_minutes: F.total_minutes.value, image_url: photo, tags: [...selected],
    ingredients: F.ingredients.value.split("\n").map(parseIngredient).filter(Boolean),
    steps: F.steps.value.split("\n"), notes: F.notes.value, source_url: F.source_url.value, source_notes: F.source_notes.value,
  });
  // keep a new recipe in this browser while it's being written
  let timer = null;
  function keep() { if (id) return; clearTimeout(timer); timer = setTimeout(() => saveDraft(current()), 300); }
  form.addEventListener("input", keep);
  if (!id && draft) saveDraft(current());
  if (restored) toast("Picked up where you left off.", { label: "Start over", run: () => { clearDraft(); editView(null, app); } });
  $('[data-act="cancel"]', app).onclick = () => { if (!id) clearDraft(); };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $(".error", app); err.textContent = "";
    if (!F.title.value.trim()) { err.textContent = "Add a name."; F.title.focus(); return; }
    if (uploading) { err.textContent = "The photo is still uploading."; return; }
    const btn = $('button[type="submit"]', form); btn.disabled = true;
    try { const newId = await data.saveRecipe(current()); clearTimeout(timer); if (!id) clearDraft(); toast("Saved."); location.hash = `#/recipe/${encodeURIComponent(newId)}`; }
    catch (ex) { console.error(ex); err.textContent = "Couldn’t save. " + (ex.message || "Try again."); btn.disabled = false; }
  });
}

// Dims the screen with a stirring whisk until done() is called (B-42).
function busy(text) {
  const el = document.createElement("div");
  el.className = "busy"; el.setAttribute("role", "status");
  el.innerHTML = `<div class="busy-panel">${whiskIcon()}<span class="t-label">${esc(text)}</span></div>`;
  document.body.appendChild(el);
  return () => el.remove();
}

function loadDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d && (d.title || d.ingredients?.length || d.steps?.some(Boolean)) ? d : null; } catch { return null; } }
function saveDraft(d) { try { localStorage.setItem(DRAFT, JSON.stringify({ ...d, id: null })); } catch {} }
function clearDraft() { try { localStorage.removeItem(DRAFT); } catch {} }
