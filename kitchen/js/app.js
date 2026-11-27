// Kitchen — app entry + hash router.
// Auth is checked per route (not app-wide), so a single page could be made public later.
import * as data from "./data.js";
import { $, $$ } from "./ui.js";
import { loginView } from "./views/login.js";
import { galleryView } from "./views/gallery.js";
import { detailView } from "./views/detail.js";
import { editView } from "./views/edit.js";
import { shareView } from "./views/share.js";
import { listView } from "./views/list.js";
import { importView } from "./views/import.js";
import { fillView } from "./views/fill.js";
import { weekView } from "./views/week.js";

const routes = [
  { re: /^#\/login$/, view: (p, app) => loginView(app), public: true, tab: null },
  { re: /^#\/recipes$/, view: (p, app) => galleryView(app), tab: "recipes" },
  { re: /^#\/import$/, view: (p, app) => importView(app), tab: "recipes" },
  { re: /^#\/fill$/, view: (p, app) => fillView(app), tab: "recipes" },
  { re: /^#\/add$/, view: (p, app) => editView(null, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)\/share$/, view: ([id], app) => shareView(id, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)\/edit$/, view: ([id], app) => editView(id, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)$/, view: ([id], app) => detailView(id, app), tab: "recipes" },
  { re: /^#\/week(?:\?w=(\d{4}-\d{2}-\d{2}))?$/, view: ([w], app) => weekView(app, w), tab: "week" },
  // Shopping list (Full list · Shopping) and Pantry. Old ?tab=week links land on Full list.
  { re: /^#\/list(?:\?(?:tab=(week|pantry)|mode=(shop)))?$/, view: ([tab, mode], app) => listView(app, tab === "pantry" ? "pantry" : "list", mode === "shop" ? "shop" : "full"), tab: "list" },
];

async function render() {
  const hash = location.hash || "#/recipes";
  const route = routes.find(r => r.re.test(hash));
  if (!route) { location.hash = "#/recipes"; return; }
  if (!route.public && !(await data.hasSession())) { location.hash = "#/login"; return; }
  const params = hash.match(route.re).slice(1).map(x => (x == null ? x : decodeURIComponent(x)));
  const app = $("#app");
  $("#tabbar").hidden = !route.tab;
  $$("#tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === route.tab));
  try {
    await route.view(params, app);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="t-item">Something went wrong loading this page.</p><p class="t-label grey">${String(err.message || err)}</p>`;
  }
  window.scrollTo(0, 0);
}

// Always load the newest app files after an update (see sw.js).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

(async function start() {
  $("#demo-banner").hidden = !data.isDemo;
  await data.init();
  window.addEventListener("hashchange", render);
  render();
})();
