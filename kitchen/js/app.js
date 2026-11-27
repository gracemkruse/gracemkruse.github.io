// Kitchen — app entry + hash router.
// Auth is checked per route (not app-wide), so a single page could be made public later.
import * as data from "./data.js";
import { $, $$ } from "./ui.js";
import { whiskIcon } from "./icons.js";
import { tourCheck } from "./tour.js";
import { loginView } from "./views/login.js";
import { galleryView } from "./views/gallery.js";
import { detailView } from "./views/detail.js";
import { editView } from "./views/edit.js";
import { shareView } from "./views/share.js";
import { listView } from "./views/list.js";
import { importView } from "./views/import.js";
import { fillView } from "./views/fill.js";
import { weekView } from "./views/week.js";
import { settingsView, archivedView } from "./views/settings.js";
import { joinView, privacyView } from "./views/join.js";

const routes = [
  { re: /^#\/login$/, view: (p, app) => loginView(app), public: true, tab: null },
  { re: /^#\/join\/([A-Za-z0-9_-]+)$/, view: ([code], app) => joinView(code, app), public: true, tab: null },
  { re: /^#\/privacy$/, view: (p, app) => privacyView(app), public: true, tab: null },
  { re: /^#\/recipes$/, view: (p, app) => galleryView(app), tab: "recipes" },
  { re: /^#\/import$/, view: (p, app) => importView(app), tab: "recipes" },
  { re: /^#\/fill$/, view: (p, app) => fillView(app), tab: "recipes" },
  { re: /^#\/add$/, view: (p, app) => editView(null, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)\/share$/, view: ([id], app) => shareView(id, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)\/edit$/, view: ([id], app) => editView(id, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)$/, view: ([id], app) => detailView(id, app), tab: "recipes" },
  { re: /^#\/week(?:\?w=(\d{4}-\d{2}-\d{2}))?$/, view: ([w], app) => weekView(app, w), tab: "week" },
  // Settings is a page, not a tab: the tab bar shows with nothing selected.
  { re: /^#\/settings$/, view: (p, app) => settingsView(app), tab: "settings" },
  { re: /^#\/archived$/, view: (p, app) => archivedView(app), tab: "settings" },
  // Shopping list (Full list · Shopping) and Pantry. Old ?tab=week links land on Full list.
  { re: /^#\/list(?:\?(?:tab=(week|pantry)|mode=(shop)))?$/, view: ([tab, mode], app) => listView(app, tab === "pantry" ? "pantry" : "list", mode === "shop" ? "shop" : "full"), tab: "list" },
];

async function render() {
  const hash = location.hash || "#/recipes";
  const route = routes.find(r => r.re.test(hash));
  if (!route) { location.hash = "#/recipes"; return; }
  if (!route.public && !(await data.hasSession())) { location.hash = "#/login"; return; }
  if (!route.public) await settingUp();
  const params = hash.match(route.re).slice(1).map(x => (x == null ? x : decodeURIComponent(x)));
  const app = $("#app");
  $("#tabbar").hidden = !route.tab;
  $$("#tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === route.tab));
  try {
    await route.view(params, app);
    if (!route.public) tourCheck();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="t-item">Something went wrong loading this page.</p><p class="t-label grey">${String(err.message || err)}</p>`;
  }
  window.scrollTo(0, 0);
}

// A brand-new account gets its starter recipes and staples on the first screen after signing in.
// Only shows the whisk if it takes a moment (it's a no-op for everyone else).
async function settingUp() {
  const work = data.seedIfNew();
  const t = setTimeout(() => {
    const el = document.createElement("div"); el.className = "busy"; el.id = "setting-up";
    el.innerHTML = `<div class="busy-panel">${whiskIcon()}<span class="t-label">Setting up your kitchen…</span></div>`;
    document.body.appendChild(el);
  }, 300);
  await work; clearTimeout(t); document.getElementById("setting-up")?.remove();
}

// Always load the newest app files after an update (see sw.js).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

(async function start() {
  $("#demo-banner").hidden = !data.isDemo;
  await data.init();
  window.addEventListener("hashchange", render);
  render();
})();
