// Kitchen — app entry + hash router.
// Auth is checked per route (not app-wide), so a single page could be made public later.
import * as data from "./data.js";
import { $, $$ } from "./ui.js";
import { loginView } from "./views/login.js";
import { galleryView } from "./views/gallery.js";
import { detailView } from "./views/detail.js";
import { editView } from "./views/edit.js";
import { comingView } from "./views/coming.js";

const routes = [
  { re: /^#\/login$/, view: (p, app) => loginView(app), public: true, tab: null },
  { re: /^#\/recipes$/, view: (p, app) => galleryView(app), tab: "recipes" },
  { re: /^#\/add$/, view: (p, app) => editView(null, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)\/edit$/, view: ([id], app) => editView(id, app), tab: "recipes" },
  { re: /^#\/recipe\/([^/]+)$/, view: ([id], app) => detailView(id, app), tab: "recipes" },
  { re: /^#\/week$/, view: (p, app) => comingView(app, "This Week", "Plan the week, mark meals made, and step back through past weeks. This is the next build."), tab: "week" },
  { re: /^#\/list$/, view: (p, app) => comingView(app, "Shopping List", "To buy, Week and Pantry tabs, generated from This Week, with your hand-added items. Coming after This Week."), tab: "list" },
];

async function render() {
  const hash = location.hash || "#/recipes";
  const route = routes.find(r => r.re.test(hash));
  if (!route) { location.hash = "#/recipes"; return; }
  if (!route.public && !(await data.hasSession())) { location.hash = "#/login"; return; }
  const params = hash.match(route.re).slice(1).map(decodeURIComponent);
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

(async function start() {
  $("#demo-banner").hidden = !data.isDemo;
  await data.init();
  window.addEventListener("hashchange", render);
  render();
})();
