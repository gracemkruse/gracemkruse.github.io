import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, $$, toast, photoStyle } from "../ui.js";

// Manual entry + edit. Required: title and servings.
export async function editView(id, app) {
  const existing = id ? await data.getRecipe(id) : null;
  if (id && !existing) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p>`; return; }
  const allTags = await data.listTags();
  const r = existing || { title: "", servings: "", total_minutes: "", image_url: "", tags: [], ingredients: [{}, {}, {}], steps: [], notes: "", source_url: "", source_notes: "" };
  const selected = new Set(r.tags);

  const ingRow = (g = {}) => `
    <div class="ing-edit">
      <input class="t-item" name="amount" inputmode="decimal" placeholder="1" value="${esc(g.amount ?? "")}" aria-label="Amount">
      <input class="t-item" name="unit" placeholder="cup" value="${esc(g.unit ?? "")}" aria-label="Unit">
      <input class="t-item" name="name" placeholder="ingredient" value="${esc(g.name ?? "")}" aria-label="Ingredient">
      <input class="t-item" name="prep" placeholder="prep" value="${esc(g.prep ?? "")}" aria-label="Prep note">
      <button type="button" class="remove" aria-label="Remove ingredient">${icon("close", true)}</button>
    </div>`;

  app.innerHTML = `
    <form class="form" novalidate>
      <div class="topline"><a class="btn-text grey t-label" href="${id ? `#/recipe/${encodeURIComponent(id)}` : "#/recipes"}">${icon("back", true)} ${id ? "Recipe" : "Recipes"}</a></div>
      <h1 class="t-page page-title">${id ? "Edit recipe" : "New recipe"}</h1>

      <label class="field"><span class="t-label">Title</span><input class="t-item" name="title" required value="${esc(r.title)}" placeholder="Recipe name"></label>
      <div class="two">
        <label class="field"><span class="t-label">Serves (required)</span><input class="t-item" name="servings" inputmode="numeric" required value="${esc(r.servings ?? "")}" placeholder="4"></label>
        <label class="field"><span class="t-label">Time in minutes</span><input class="t-item" name="total_minutes" inputmode="numeric" value="${esc(r.total_minutes ?? "")}" placeholder="45"></label>
      </div>
      <div class="field">
        <span class="t-label">Photo</span>
        <div class="photo-pick">
          <div class="photo-preview" style="${photoStyle({ ...r, id: id || "new" })}"></div>
          <div class="photo-actions">
            <label class="btn-text t-label">${icon("plus", true)} <span data-pick-label>${r.image_url ? "Change photo" : "Add photo"}</span><input type="file" accept="image/*" data-file hidden></label>
            <button type="button" class="btn-text grey t-label" data-act="rm-photo" ${r.image_url ? "" : "hidden"}>Remove photo</button>
            <span class="hint t-label" data-photo-status></span>
          </div>
        </div>
        <input class="t-item" name="image_url" value="${esc(r.image_url?.startsWith("data:") ? "" : r.image_url ?? "")}" placeholder="or paste an image link" aria-label="Photo link">
      </div>

      <div class="field">
        <span class="t-label">Tags</span>
        <div class="chips">${allTags.map(t => `<button type="button" class="chip t-label" data-tag="${esc(t)}" aria-pressed="${selected.has(t)}">${esc(t)}</button>`).join("")}</div>
        <label class="input-line">${icon("plus", false, "green")}<input class="t-item" name="newtag" placeholder="New tag — press Enter"></label>
      </div>

      <div class="field">
        <div class="section-head" style="margin-top:0"><span class="t-label">Ingredients</span></div>
        <div class="ing-head t-label"><span>Amt</span><span>Unit</span><span>Ingredient</span><span>Prep</span><span></span></div>
        <div class="ings">${(r.ingredients.length ? r.ingredients : [{}]).map(ingRow).join("")}</div>
        <button type="button" class="btn-text t-label" data-act="add-ing" style="margin-top:8px">${icon("plus", true)} Add ingredient</button>
      </div>

      <label class="field"><span class="t-label">Method — one step per line</span><textarea class="t-instr" name="steps" placeholder="Warm the oil in a heavy pot…">${esc(r.steps.join("\n"))}</textarea></label>
      <label class="field"><span class="t-label">Notes</span><textarea class="t-instr" name="notes" style="min-height:96px" placeholder="Double the garlic.">${esc(r.notes ?? "")}</textarea></label>
      <div class="two">
        <label class="field"><span class="t-label">Source link</span><input class="t-item" name="source_url" value="${esc(r.source_url ?? "")}" placeholder="https://…"></label>
        <label class="field"><span class="t-label">Source notes</span><input class="t-item" name="source_notes" value="${esc(r.source_notes ?? "")}" placeholder="Grandma’s card"></label>
      </div>

      <p class="error t-label clay" aria-live="assertive"></p>
      <div class="form-actions">
        <button class="btn-primary t-label" type="submit">Save recipe</button>
        <a class="btn-text grey t-label" href="${id ? `#/recipe/${encodeURIComponent(id)}` : "#/recipes"}">Cancel</a>
      </div>
    </form>`;

  const form = $(".form", app), F = form.elements, ings = $(".ings", app), chips = $(".chips", app);
  const wireRemove = () => $$(".remove", ings).forEach(b => b.onclick = () => { b.closest(".ing-edit").remove(); if (!ings.children.length) ings.insertAdjacentHTML("beforeend", ingRow()); wireRemove(); });
  wireRemove();
  $('[data-act="add-ing"]', app).onclick = () => { ings.insertAdjacentHTML("beforeend", ingRow()); wireRemove(); $$(".ing-edit", ings).at(-1).querySelector('[name="amount"]').focus(); };
  const wireChip = c => c.onclick = () => { const t = c.dataset.tag; selected.has(t) ? selected.delete(t) : selected.add(t); c.setAttribute("aria-pressed", selected.has(t)); };
  $$(".chip", chips).forEach(wireChip);
  F.newtag.addEventListener("keydown", e => {
    if (e.key !== "Enter") return; e.preventDefault();
    const t = F.newtag.value.trim(); if (!t) return;
    const known = [...selected, ...allTags].find(x => x.toLowerCase() === t.toLowerCase());
    if (!known) { chips.insertAdjacentHTML("beforeend", `<button type="button" class="chip t-label" data-tag="${esc(t)}" aria-pressed="true">${esc(t)}</button>`); wireChip(chips.lastElementChild); selected.add(t); }
    else { selected.add(known); const c = [...$$(".chip", chips)].find(x => x.dataset.tag === known); if (c) c.setAttribute("aria-pressed", "true"); }
    F.newtag.value = "";
  });

  // Photo: upload right away so Save stays quick; the link field always holds the current photo.
  let photo = r.image_url || "", uploading = false;
  const preview = $(".photo-preview", app), status = $("[data-photo-status]", app), rm = $('[data-act="rm-photo"]', app);
  const showPhoto = () => { if (photo) preview.style.backgroundImage = `url("${photo.replace(/["\\]/g, encodeURIComponent)}")`; else preview.setAttribute("style", photoStyle({ id: id || "new", title: F.title.value })); rm.hidden = !photo; $("[data-pick-label]", app).textContent = photo ? "Change photo" : "Add photo"; };
  $("[data-file]", app).onchange = async e => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    uploading = true; status.textContent = "Uploading…"; status.classList.remove("clay");
    try { photo = await data.uploadPhoto(file); F.image_url.value = photo.startsWith("data:") ? "" : photo; status.textContent = ""; showPhoto(); }
    catch (ex) { console.error(ex); status.textContent = ex.message || "Couldn’t upload — try again."; status.classList.add("clay"); }
    uploading = false;
  };
  rm.onclick = () => { photo = ""; F.image_url.value = ""; showPhoto(); };
  F.image_url.oninput = () => { photo = F.image_url.value.trim(); showPhoto(); };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $(".error", app); err.textContent = "";
    const servings = Number(F.servings.value);
    if (!F.title.value.trim()) { err.textContent = "Add a title."; F.title.focus(); return; }
    if (!servings || servings < 1) { err.textContent = "Serves is required — how many people does it feed?"; F.servings.focus(); return; }
    if (uploading) { err.textContent = "The photo is still uploading — one moment."; return; }
    const recipe = {
      id, title: F.title.value, servings, total_minutes: F.total_minutes.value, image_url: photo,
      tags: [...selected],
      ingredients: $$(".ing-edit", ings).map(row => ({ amount: row.querySelector('[name="amount"]').value, unit: row.querySelector('[name="unit"]').value, name: row.querySelector('[name="name"]').value, prep: row.querySelector('[name="prep"]').value })),
      steps: F.steps.value.split("\n"), notes: F.notes.value, source_url: F.source_url.value, source_notes: F.source_notes.value,
    };
    const btn = $('button[type="submit"]', form); btn.disabled = true;
    try { const newId = await data.saveRecipe(recipe); toast("Saved."); location.hash = `#/recipe/${encodeURIComponent(newId)}`; }
    catch (ex) { console.error(ex); err.textContent = "Couldn’t save — " + (ex.message || "try again."); btn.disabled = false; }
  });
}
