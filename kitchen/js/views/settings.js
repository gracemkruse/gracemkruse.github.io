// Settings (from your initial → Settings). The home for ingredient clean-up and recipe tools.
// Name, birth year, gender, invites, privacy and delete account arrive with accounts.
import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, toast, iso } from "../ui.js";
import { suggestGroups } from "../ingredients.js";
import { openTidy } from "./list.js";

export async function settingsView(app) {
  const [m, d] = await Promise.all([data.me(), data.shoppingData(iso(new Date()), iso(new Date()))]);
  const dupes = suggestGroups(d.pantry).length;
  const row = (label, href, note = "", attr = "") => `
    <a class="set-row" ${href ? `href="${href}"` : `role="button" tabindex="0" ${attr}`}>
      <span class="t-item">${esc(label)}</span><span class="spacer"></span>
      ${note ? `<span class="t-label ${note.cls || "grey"}">${esc(note.text)}</span>` : ""}${icon("open", true)}
    </a>`;
  app.innerHTML = `
    <section class="settings">
      <button class="btn-text grey t-label back" type="button" data-back>${icon("back", true)} Back</button>
      <h1 class="t-page page-title">Settings</h1>

      <h2 class="t-label grey set-head">Account</h2>
      <div class="set-row"><span class="t-label grey set-key">Email</span><span class="t-item">${esc(m.email || "—")}</span></div>

      <h2 class="t-label grey set-head">Ingredients</h2>
      ${row("All ingredients", "#/list?tab=pantry", { text: "Rename · category" })}
      ${row("Tidy up", "", dupes ? { text: `${dupes} to review`, cls: "green" } : "", "data-tidy")}

      <h2 class="t-label grey set-head">Recipes</h2>
      ${row("Fill in missing recipes", "#/fill")}
      ${row("Archived recipes", "#/archived")}
      ${row("Download my recipes", "", "", "data-export")}

      <div class="danger-zone"><button class="btn-text t-label" type="button" data-signout>Sign out</button></div>
    </section>`;

  $("[data-back]", app).onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/recipes"));
  const tidy = $("[data-tidy]", app);
  tidy.onclick = () => openTidy(d.pantry, () => settingsView(app));
  tidy.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tidy.click(); } };
  const exp = $("[data-export]", app);
  exp.onclick = async () => {
    try {
      const all = await data.exportRecipes();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `kitchen-recipes-${iso(new Date())}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`${all.recipes.length} recipes downloaded.`);
    } catch (e) { console.error(e); toast("Couldn’t download. Try again."); }
  };
  exp.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); exp.click(); } };
  $("[data-signout]", app).onclick = async () => { await data.signOut(); location.hash = "#/login"; };
}

// Archived recipes: hidden from Recipes, never deleted. Restore puts one back.
export async function archivedView(app) {
  const list = await data.listArchived();
  app.innerHTML = `
    <section class="settings">
      <a class="btn-text grey t-label back" href="#/settings">${icon("back", true)} Settings</a>
      <h1 class="t-page page-title">Archived recipes</h1>
      ${list.length ? list.map(r => `
        <div class="set-row">
          <a class="t-recipe recipe-name" href="#/recipe/${encodeURIComponent(r.id)}">${esc(r.title)}</a><span class="spacer"></span>
          <button class="btn-text t-label" type="button" data-restore="${esc(r.id)}">Restore</button>
        </div>`).join("") : `<p class="t-item grey">Nothing archived.</p>`}
    </section>`;
  app.querySelectorAll("[data-restore]").forEach(b => b.onclick = async () => {
    try { await data.restoreRecipe(b.dataset.restore); toast("Back in Recipes."); archivedView(app); }
    catch (e) { console.error(e); toast("Couldn’t restore. Try again."); }
  });
}
