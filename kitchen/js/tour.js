// How it works: a 5-step tour on the real screens. A dark card at the bottom says what to try,
// a green ring shows where. It moves on when you actually do the thing (or tap Next where there's
// nothing to do). Starts by itself for a new account; your initial → How it works replays it.
import * as data from "./data.js";
import { esc } from "./ui.js";

const KEY = "kitchen-tour";   // current step index while a tour is running (this device)
const N = 5;
// Each step: where it happens, what to ring, the words, and what moves it on.
//   advance: an app event name ("kitchen:planned" …), or { route } to wait for a page, or "next" for a button.
const STEPS = [
  { step: 1, route: /^#\/recipes/, target: ".cards .card, .cards .tile .photo",
    text: lib => lib ? "These are your recipes. Tap one to open it." : "These are your starter recipes. Tap one to open it.",
    advance: { route: /^#\/recipe\/[^/]+$/ } },
  { step: 2, route: /^#\/recipe\/[^/]+$/, target: '[data-act="week"]',
    text: () => "Plan it: tap Add to this week, then pick a day.", advance: "kitchen:planned" },
  { step: 2, route: /./, target: '#tabbar a[data-tab="list"]',
    text: () => "Now open the List. Everything that recipe needs is already there.", advance: { route: /^#\/list(\?mode=full)?$|^#\/list$/ } },
  { step: 3, route: /^#\/list$/, target: ".srow [data-status]",
    text: () => "This is everything your week’s meals need. Tap a status to say what you have at home: In stock, Low or Out. Skip anything you won’t buy.",
    advance: "kitchen:status" },
  { step: 4, route: /^#\/list/, target: '.list-mode a[href$="mode=shop"]',
    text: () => "At the shop, switch to Shopping. You’ll only see what you need.", advance: { route: /^#\/list\?mode=shop$/ } },
  { step: 4, route: /^#\/list\?mode=shop$/, target: "[data-cart], [data-extra]",
    text: () => "Tick things as they go in your cart.", advance: "kitchen:cart" },
  { step: 4, route: /^#\/list\?mode=shop$/, target: ".done-bar [data-finish]",
    text: () => "When you’re finished, tap Done shopping: everything in the cart is marked In stock, so next week’s list is right.", advance: "next" },
  { step: 5, route: /./, target: '#tabbar a[data-tab="recipes"]',
    text: () => "Last one: open a recipe to cook from.", advance: { route: /^#\/recipe\/[^/]+$/ } },
  { step: 5, route: /^#\/recipe\/[^/]+$/, target: "[data-step]",
    text: () => "Cooking? Tap each step as you go. When you’re done, tap Cooked today and it moves to today on This Week.", advance: "kitchen:step" },
];

let i = -1, lib = false, el = null, ring = null, onEvt = null, checked = false;
const get = () => { try { return Number(localStorage.getItem(KEY) ?? -1); } catch { return -1; } };
const set = v => { try { v < 0 ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, String(v)); } catch {} };

// Called by the app after every page renders.
export async function tourCheck() {
  i = get();
  if (i < 0 && !data.isDemo && !checked) {
    checked = true;   // once per session: a new account (no onboarded_at yet) starts the tour
    const p = await data.getProfile().catch(() => null);
    if (p && !p.onboarded_at) { i = 0; set(0); }
  }
  if (i >= 0) { lib = await libraryAccount(); show(); } else hide();
}

export function startTour() { set(0); location.hash = "#/recipes"; setTimeout(tourCheck, 50); }

async function libraryAccount() {
  try { const rs = await data.listRecipes(); return rs.length > 6; } catch { return false; }
}

function show() {
  hide();
  if (i >= STEPS.length) return finish(true);
  const s = STEPS[i];
  if (!s.route.test(location.hash || "#/recipes")) return;   // wait for the right page
  el = document.createElement("div");
  el.className = "tour-coach"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "How it works");
  el.innerHTML = `
    <div class="tour-top"><span class="t-label tour-try">Try it</span><span class="tour-dots">${Array.from({ length: N }, (_, k) => `<i class="${k + 1 === s.step ? "on" : ""}"></i>`).join("")}</span></div>
    <p class="t-instr">${esc(s.text(lib))}</p>
    <div class="tour-actions">${s.advance === "next" ? `<button class="tour-next t-label" type="button" data-next>Next</button>` : ""}<button class="btn-text t-label tour-skip" type="button" data-skip>Skip tour</button></div>`;
  document.body.appendChild(el);
  el.querySelector("[data-skip]").onclick = () => finish(false);
  el.querySelector("[data-next]")?.addEventListener("click", next);
  placeRing(s.target);
  if (typeof s.advance === "string" && s.advance !== "next") { onEvt = () => next(); window.addEventListener(s.advance, onEvt, { once: true }); }
}

// The ring finds its target again every frame: pages redraw themselves after a tap.
function placeRing(sel) {
  ring = document.createElement("div"); ring.className = "tour-ring"; ring.hidden = true; document.body.appendChild(ring);
  let scrolled = false;
  const follow = () => {
    if (!ring) return;
    const t = document.querySelector(sel);
    if (t && t.isConnected) {
      if (!scrolled) { t.scrollIntoView({ block: "center", behavior: "smooth" }); scrolled = true; }
      const r = t.getBoundingClientRect(); ring.hidden = !r.width;
      Object.assign(ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
      // never cover what we're pointing at: the card moves to the top when they'd overlap
      if (el) { const c = el.getBoundingClientRect(); if (!el.classList.contains("at-top") && r.bottom > c.top - 8 && r.top < c.bottom) el.classList.add("at-top"); }
    } else ring.hidden = true;
    requestAnimationFrame(follow);
  };
  follow();
}

function hide() {
  el?.remove(); el = null; ring?.remove(); ring = null;
  if (onEvt) { for (const s of STEPS) if (typeof s.advance === "string") window.removeEventListener(s.advance, onEvt); onEvt = null; }
}

function next() { set(++i); show(); }

async function finish(done) {
  hide(); set(-1);
  try { await data.updateProfile({ onboarded_at: new Date().toISOString() }); } catch (e) { console.error(e); }
  if (!done) return;
  const box = document.createElement("div"); box.className = "tour-coach tour-done";
  box.innerHTML = `<div class="tour-top"><span class="t-label tour-try">You’re set</span></div>
    <p class="t-instr">${lib ? "That’s it. Everything in your pantry starts as Out until you check it." : "That’s it. Your pantry has the everyday basics, all marked Out until you check them."} Find this tour again from your initial, top right.</p>
    <div class="tour-actions"><button class="tour-next t-label" type="button">Start cooking</button></div>`;
  document.body.appendChild(box);
  box.querySelector("button").onclick = () => { box.remove(); location.hash = "#/recipes"; };
}

// Routes that wait for a page move on when that page opens.
window.addEventListener("hashchange", () => {
  const s = STEPS[get()]; if (!s) return;
  if (s.advance && s.advance.route && s.advance.route.test(location.hash)) { set(get() + 1); }
});
