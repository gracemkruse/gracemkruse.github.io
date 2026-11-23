import * as data from "../data.js";
import { icon, whiskIcon } from "../icons.js";
import { esc, $, $$, toast, photoStyle, niceTitle, isWebLink, amount } from "../ui.js";
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
  const ingText = (r.ingredients || []).filter(g => g && g.name).map(g => [amount(g.amount, g.unit), g.name.toLowerCase() + (g.prep ? `, ${g.prep}` : "")].filter(Boolean).join(" ")).join("\n");
  const back = id ? `#/recipe/${encodeURIComponent(id)}` : "#/recipes";

  app.innerHTML = `
    <form class="form" novalidate>
      <div class="topline"><a class="btn-text grey t-label" href="${back}">${icon("back", true)} ${id ? "Recipe" : "Recipes"}</a></div>
      <textarea class="t-page title-input" name="title" rows="1" required placeholder="Recipe name" aria-label="Recipe name">${esc(niceTitle(r.title))}</textarea>

      <div class="fill-from">
        <label class="fill-box">
          <span class="t-label">${icon("link", true)} Paste a link or text</span>
          <input class="t-item" type="text" name="link" inputmode="url" autocomplete="off" placeholder="https://… or the whole recipe" value="${esc(draft?.source_url && isWebLink(draft.source_url) ? draft.source_url : (id && isWebLink(r.source_url) ? r.source_url : ""))}">
        </label>
        <label class="fill-box">
          <span class="t-label">${icon("plus", true)} Recipe photo</span>
          <span class="t-item grey">Up to 3 pages</span>
          <input type="file" accept="image/*" multiple data-recipe-photos hidden>
        </label>
      </div>
      <p class="t-label clay" data-fill-status hidden></p>

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
      <label class="field"><span class="t-label">Notes</span><textarea class="t-instr" name="notes" style="min-height:96px" placeholder="Double the garlic.">${esc(r.notes ?? "")}</textarea></label>

      <div class="field">
        <span class="t-label">Tags</span>
        <div class="chips">${[...new Set([...allTags, ...selected])].map(t => `<button type="button" class="chip t-label" data-tag="${esc(t)}" aria-pressed="${selected.has(t)}">${esc(t)}</button>`).join("")}</div>
        <label class="input-line">${icon("plus", false, "green")}<input class="t-item" name="newtag" placeholder="New tag, then Enter"></label>
      </div>

      <div class="form-actions">
        <button class="btn-primary t-label" type="submit">Save recipe</button>
        <a class="btn-text grey t-label" href="${back}" data-act="cancel">Cancel</a>
        <span class="error t-label clay" aria-live="assertive"></span>
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
  const wireChip = c => c.onclick = () => { const t = c.dataset.tag; selected.has(t) ? selected.delete(t) : selected.add(t); c.setAttribute("aria-pressed", selected.has(t)); keep(); };
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
  const readText = text => {
    const t = parseRecipeText(text);
    if (!t.ingredients.length && !t.steps.length) { say(fillStatus, "Couldn’t find a recipe in that text."); return; }
    refill({ title: t.title, ingredients: t.ingredients.map(parseIngredient).filter(Boolean), steps: t.steps });
  };
  // pasting is enough: a link is read right away, and so is a whole recipe (B-83)
  F.link.addEventListener("paste", e => {
    const text = e.clipboardData?.getData("text") || "";
    if (!text.trim() || [...(e.clipboardData?.files || [])].length) return;
    e.preventDefault();
    if (/^https?:\/\/\S+$/i.test(text.trim())) { F.link.value = text.trim(); readLink(F.link.value); }
    else readText(text);
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
