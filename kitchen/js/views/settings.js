// Settings (from your initial → Settings). Account details, ingredient clean-up, recipe tools,
// people (only for whoever can invite), privacy, sign out and delete account.
import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, toast, iso, sheet } from "../ui.js";
import { suggestGroups } from "../ingredients.js";
import { openTidy } from "./list.js";

const GENDERS = ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"];
const joinLink = code => `${location.origin}${location.pathname}#/join/${code}`;

export async function settingsView(app) {
  const [m, p, d] = await Promise.all([data.me(), data.getProfile(), data.shoppingData(iso(new Date()), iso(new Date()))]);
  const invites = p.can_invite ? await data.listInvites().catch(() => []) : [];
  const dupes = suggestGroups(d.pantry).length;
  const link = (label, href, note = "", attr = "") => `
    <a class="set-row" ${href ? `href="${href}"` : `role="button" tabindex="0" ${attr}`}>
      <span class="t-item">${esc(label)}</span><span class="spacer"></span>
      ${note ? `<span class="t-label ${note.cls || "grey"}">${esc(note.text)}</span>` : ""}${icon("open", true)}
    </a>`;
  const field = (key, label, value, act) => `
    <div class="set-row"><span class="t-label grey set-key">${label}</span><span class="t-item">${esc(value || "—")}</span><span class="spacer"></span>
      ${act ? `<button class="btn-text t-label" type="button" data-edit="${key}">${act}</button>` : ""}</div>`;
  const now = new Date();
  const people = invites.map(i => {
    const group = (i.max_uses || 1) > 1, closed = new Date(i.expires_at) < now;
    if (group) {
      const names = (i.invite_joins || []).sort((a, b) => a.joined_at < b.joined_at ? -1 : 1).map(j => j.name).filter(Boolean);
      const full = i.uses >= i.max_uses;
      const right = closed || full ? `<span class="t-label grey">${full ? "Full" : "Closed"}</span>`
        : `<button class="btn-text t-label" type="button" data-share="${esc(i.code)}">Share link</button><button class="btn-text grey t-label" type="button" data-stop="${esc(i.code)}">Stop</button>`;
      return `<div class="set-row set-group"><span class="t-item">${esc(i.name || "Group link")}</span><span class="spacer"></span>${right}</div>
        <p class="t-label grey set-joined">${i.uses} of ${i.max_uses} joined${names.length ? ": " + esc(names.join(", ")) : ""}</p>`;
    }
    const used = !!i.used_by, expired = !used && closed;
    const right = used ? `${i.with_library ? "" : `<button class="btn-text t-label" type="button" data-copy="${esc(i.code)}">Give my recipes</button>`}<span class="t-label green">Joined</span>`
      : expired ? `<span class="t-label grey">Expired</span>`
      : `<button class="btn-text t-label" type="button" data-share="${esc(i.code)}">Share link</button><span class="t-label grey">Invite sent</span>`;
    return `<div class="set-row"><span class="t-item">${esc(i.name || "Someone")}</span><span class="spacer"></span>${right}</div>`;
  }).join("");

  app.innerHTML = `
    <section class="settings">
      <button class="btn-text grey t-label back" type="button" data-back>${icon("back", true)} Back</button>
      <h1 class="t-page page-title">Settings</h1>

      <h2 class="t-label grey set-head">Account</h2>
      ${field("display_name", "Name", p.display_name || m.name, "Edit")}
      ${field("", "Email", m.email)}
      ${field("birth_year", "Birth year", p.birth_year, p.birth_year ? "Edit" : "Add")}
      ${field("gender", "Gender", p.gender, p.gender ? "Edit" : "Add")}

      <h2 class="t-label grey set-head">Ingredients</h2>
      ${link("Tidy up", "", dupes ? { text: `${dupes} to review`, cls: "green" } : "", "data-tidy")}

      <h2 class="t-label grey set-head">Recipes</h2>
      ${link("Fill in missing recipes", "#/fill")}
      ${link("Archived recipes", "#/archived")}
      ${link("Download my recipes", "", "", "data-export")}

      <h2 class="t-label grey set-head">Help</h2>
      ${link("Privacy", "#/privacy")}

      ${p.can_invite ? `
        <div class="set-head-row"><h2 class="t-label grey set-head">People · only you</h2><button class="btn-text t-label" type="button" data-invite>Invite someone</button></div>
        ${people || `<p class="t-instr grey">No one invited yet.</p>`}` : ""}

      <div class="danger-zone">
        <button class="btn-text t-label" type="button" data-signout>Sign out</button>
        <button class="btn-text grey t-label" type="button" data-delete>Delete account</button>
      </div>
    </section>`;

  const again = () => settingsView(app);
  const keyClick = el => { if (el) el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } }; };
  $("[data-back]", app).onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/recipes"));
  const tidy = $("[data-tidy]", app); tidy.onclick = () => openTidy(d.pantry, again); keyClick(tidy);
  const exp = $("[data-export]", app); keyClick(exp);
  exp.onclick = async () => {
    try {
      const all = await data.exportRecipes();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `kitchen-recipes-${iso(new Date())}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`${all.recipes.length} recipes downloaded.`);
    } catch (e) { console.error(e); toast("Couldn’t download. Try again."); }
  };
  app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editField(b.dataset.edit, p, again));
  $("[data-signout]", app).onclick = async () => { await data.signOut(); location.hash = "#/login"; };
  $("[data-delete]", app).onclick = () => deleteSheet();
  const inv = $("[data-invite]", app); if (inv) inv.onclick = () => inviteSheet(again);
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = () => shareLink(joinLink(b.dataset.share)));
  app.querySelectorAll("[data-stop]").forEach(b => b.onclick = async () => {
    if (!confirm("Stop this link? No one else can join with it. People who already joined keep their accounts.")) return;
    try { await data.stopInvite(b.dataset.stop); toast("Link stopped."); again(); } catch (e) { console.error(e); toast("Couldn’t stop it. Try again."); }
  });
  app.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copySheet(invites.find(i => i.code === b.dataset.copy)));
}

function editField(key, p, done) {
  const label = { display_name: "Name", birth_year: "Birth year", gender: "Gender" }[key];
  const body = key === "gender"
    ? `<div class="chips">${GENDERS.map(g => `<button class="chip t-label" type="button" data-g="${esc(g)}" aria-pressed="${p.gender === g}">${esc(g)}</button>`).join("")}</div>`
    : `<label class="input-line"><input class="t-item" name="v" value="${esc(p[key] ?? "")}" ${key === "birth_year" ? 'inputmode="numeric" maxlength="4"' : 'autocomplete="given-name"'}></label>`;
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">${label}</span><button class="t-label grey" data-close>Close</button></div>
    <form class="edit-field">${body}
      <p class="error t-label" aria-live="assertive"></p>
      <div class="sheet-actions">${p[key] != null && key !== "display_name" ? `<button class="btn-text grey t-label" type="button" data-clear>Clear</button>` : ""}<button class="btn-primary t-label" type="submit">Save</button></div>
    </form>`, label);
  let picked = p.gender;
  el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { picked = b.dataset.g; el.querySelectorAll("[data-g]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  const save = async v => {
    try { await data.updateProfile({ [key]: v }); close(); toast("Saved."); done(); }
    catch (e) { console.error(e); el.querySelector(".error").textContent = "Couldn’t save. Try again."; }
  };
  const clear = el.querySelector("[data-clear]"); if (clear) clear.onclick = () => save(null);
  el.querySelector("form").onsubmit = e => {
    e.preventDefault();
    if (key === "gender") return save(picked || null);
    const v = el.querySelector("input").value.trim();
    if (key === "birth_year") {
      if (!v) return save(null);
      const y = Number(v), now = new Date().getFullYear();
      if (!/^\d{4}$/.test(v) || y < 1900 || y > now) { el.querySelector(".error").textContent = "That birth year doesn’t look right."; return; }
      if (now - y < 13) { el.querySelector(".error").textContent = "Kitchen is for ages 13 and up."; return; }
      return save(y);
    }
    if (!v) { el.querySelector(".error").textContent = "Add your name."; return; }
    save(v.slice(0, 60));
  };
  el.querySelector("input")?.focus();
}

async function shareLink(url) {
  if (navigator.share) { try { await navigator.share({ title: "Join me on Kitchen", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); toast("Invite link copied."); } catch { prompt("Copy this invite link:", url); }
}

function inviteSheet(done) {
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">Invite someone</span><button class="t-label grey" data-close>Close</button></div>
    <form class="edit-field">
      <nav class="chips" aria-label="Who it’s for">${[["one", "One person"], ["group", "Group"]].map(([k, l]) => `<button class="chip t-label" type="button" data-kind="${k}" aria-pressed="${k === "one"}">${l}</button>`).join("")}</nav>
      <p class="t-instr" data-kind-note>They get a link to join with their own recipes. Each link works once and lasts 14 days.</p>
      <label class="input-line"><input class="t-item" name="n" placeholder="Their name (optional)"></label>
      <button class="check-row" type="button" data-opt="library" aria-pressed="false"><span class="box"></span><span class="t-item">Give them a copy of my recipes</span></button>
      <button class="check-row" type="button" data-opt="meals" aria-pressed="false" hidden><span class="box"></span><span class="t-item">Include meal plans</span></button>
      <p class="t-instr grey" data-opt-note hidden>They start with your recipes, ingredients and photos instead of the starter recipes. Their own copy.</p>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Share invite link</button>
      <button class="btn-text t-label" type="button" data-copylink>Copy link</button>
    </form>`, "Invite someone");
  let code = null; const opts = { library: false, meals: false, group: false };
  const lib = el.querySelector('[data-opt="library"]');
  el.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => {
    opts.group = b.dataset.kind === "group"; code = null;
    el.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", x === b));
    el.querySelector("[data-kind-note]").textContent = opts.group
      ? "One link for a group text. Up to 10 people can join in the next 7 days, each with their own account and the starter recipes. Stop it any time in Settings."
      : "They get a link to join with their own recipes. Each link works once and lasts 14 days.";
    el.querySelector('input[name="n"]').placeholder = opts.group ? "Group name, like Family (optional)" : "Their name (optional)";
    lib.hidden = opts.group;
    if (opts.group && opts.library) lib.click();
  });
  el.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => {
    opts[b.dataset.opt] = !opts[b.dataset.opt]; b.setAttribute("aria-pressed", opts[b.dataset.opt]);
    b.querySelector(".box").innerHTML = opts[b.dataset.opt] ? icon("check", true) : "";
    if (b.dataset.opt === "library") { el.querySelector('[data-opt="meals"]').hidden = !opts.library; el.querySelector("[data-opt-note]").hidden = !opts.library; if (!opts.library) opts.meals = false; }
    code = null;   // options changed: make a fresh link
  });
  const make = async () => (code ||= await data.createInvite(el.querySelector("input").value, opts));
  el.querySelector("form").onsubmit = async e => { e.preventDefault(); try { await shareLink(joinLink(await make())); close(); done(); } catch (ex) { el.querySelector(".error").textContent = ex.message; } };
  el.querySelector("[data-copylink]").onclick = async () => { try { const url = joinLink(await make()); await navigator.clipboard.writeText(url); toast("Invite link copied."); close(); done(); } catch (ex) { el.querySelector(".error").textContent = ex.message; } };
}

function copySheet(inv) {
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">Give my recipes</span><button class="t-label grey" data-close>Close</button></div>
    <form class="edit-field">
      <p class="t-instr">Copies all your recipes, tags, ingredients and photos into ${esc(inv?.name ? inv.name + "’s" : "their")} account, so they start with your whole library. It’s their own copy: changes on either side stay separate. Works once, into an account with no recipes yet.</p>
      <label class="input-line"><input class="t-item" type="email" name="e" placeholder="Their email" inputmode="email"></label>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Copy my recipes</button>
    </form>`, "Give my recipes");
  const btn = el.querySelector('button[type="submit"]');
  el.querySelector("form").onsubmit = async e => {
    e.preventDefault(); btn.disabled = true; btn.textContent = "Copying…";
    try { const r = await data.copyLibraryTo(el.querySelector("input").value.trim()); close(); toast(`Copied ${r.recipes} recipes and ${r.photos} photos.`); }
    catch (ex) { el.querySelector(".error").textContent = ex.message; btn.disabled = false; btn.textContent = "Copy my recipes"; }
  };
}

function deleteSheet() {
  const { el, close } = sheet(`
    <div class="sheet-head"><span class="t-label">Delete account</span><button class="t-label grey" data-close>Close</button></div>
    <form class="edit-field">
      <p class="t-instr">This deletes your recipes, plans, pantry, photos and account, for good. Download your recipes first if you want a copy.</p>
      <label class="input-line"><input class="t-item" name="c" placeholder="Type DELETE" autocapitalize="characters" autocomplete="off"></label>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit" disabled>Delete for good</button>
    </form>`, "Delete account");
  const input = el.querySelector("input"), btn = el.querySelector('button[type="submit"]');
  input.oninput = () => { btn.disabled = input.value.trim() !== "DELETE"; };
  el.querySelector("form").onsubmit = async e => {
    e.preventDefault(); btn.disabled = true;
    try { await data.deleteAccount(); close(); location.hash = "#/login"; }
    catch (ex) { el.querySelector(".error").textContent = ex.message; btn.disabled = false; }
  };
  input.focus();
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
