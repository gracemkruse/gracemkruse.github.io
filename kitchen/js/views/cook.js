import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, $$, toast, amount } from "../ui.js";

// Cooking view (tablet first): one step at a time in a large size, every step listed so you can jump,
// ingredients to tick off, timers pulled from the step text, and the screen kept awake.
const stepAt = {};        // recipe id → step you were on (kept while the app is open)
let leave = null;         // cleanup for timers + wake lock when you exit

export async function cookView(id, app) {
  leave?.();
  const r = await data.getRecipe(id);
  if (!r) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p><p><a class="btn-text" href="#/recipes">Back to recipes</a></p>`; return; }
  const steps = r.steps.length ? r.steps : ["No method written yet. Add steps from Edit."];
  const ticked = new Set();
  const timers = [];      // { id, label, end, done }
  let i = Math.min(stepAt[id] || 0, steps.length - 1);

  app.innerHTML = `
    <section class="cook">
      <header class="cook-top">
        <a class="btn-text grey t-label" href="#/recipe/${encodeURIComponent(r.id)}">${icon("close", true)} Exit</a>
        <span class="t-recipe cook-title">${esc(r.title)}</span>
        <span class="timers"></span>
      </header>
      <div class="cook-body">
        <div class="cook-main">
          <div class="t-label grey step-count"></div>
          <p class="cook-step t-cook"></p>
          <div class="step-timers"></div>
          <div class="section-head"><span class="t-label">Method</span><span class="t-label grey">tap a step to jump</span></div>
          <ol class="cook-steps">${steps.map((s, n) => `<li><button data-step="${n}"><span class="n t-label">${String(n + 1).padStart(2, "0")}</span><span class="t-instr">${esc(s)}</span></button></li>`).join("")}</ol>
        </div>
        <aside class="cook-ings">
          <div class="section-head"><span class="t-label">Ingredients</span><span class="t-label grey">for ${esc(r.servings)}</span></div>
          ${r.ingredients.length ? r.ingredients.map((g, n) => `
            <button class="cook-ing" data-ing="${n}" aria-pressed="false">
              <span class="box"></span>
              <span class="t-item qty">${esc(amount(g.amount, g.unit))}</span>
              <span class="t-item name">${esc(g.name.toLowerCase())}${g.prep ? `, ${esc(g.prep)}` : ""}</span>
            </button>`).join("") : `<p class="t-item grey">No ingredients listed.</p>`}
        </aside>
      </div>
      <footer class="cook-foot">
        <button class="btn-text grey t-label" data-prev>${icon("back", true)} Back</button>
        <button class="btn-primary t-label" data-next></button>
      </footer>
    </section>`;

  const paint = () => {
    stepAt[id] = i;
    $(".step-count", app).textContent = `Step ${i + 1} of ${steps.length}`;
    $(".cook-step", app).textContent = steps[i];
    $$("[data-step]", app).forEach(b => { const n = +b.dataset.step; b.classList.toggle("current", n === i); b.classList.toggle("done", n < i); b.setAttribute("aria-current", n === i ? "step" : "false"); });
    $("[data-prev]", app).disabled = i === 0;
    const last = i === steps.length - 1;
    $("[data-next]", app).innerHTML = last ? `${icon("check", true)} Done — mark made` : `Next step ${icon("open", true)}`;
    $(".step-timers", app).innerHTML = findTimes(steps[i]).map(t => `<button class="btn-text t-label" data-timer="${t.min}" data-label="${esc(t.text)}">${icon("time", true)} Start ${esc(t.text)} timer</button>`).join("");
  };
  const go = n => { i = Math.max(0, Math.min(steps.length - 1, n)); paint(); $(".cook-step", app).scrollIntoView?.({ block: "nearest", behavior: "smooth" }); };

  // ---- timers ----
  const paintTimers = () => {
    const now = Date.now();
    $(".timers", app).innerHTML = timers.map(t => { const left = Math.max(0, Math.ceil((t.end - now) / 1000));
      return `<button class="timer t-label${t.done ? " clay" : ""}" data-cancel="${t.id}" aria-label="${t.done ? "Timer done — tap to dismiss" : "Cancel timer"}">${icon("time", true)} ${t.done ? "Done" : clock(left)}</button>`; }).join("");
  };
  const tick = setInterval(() => {
    const now = Date.now();
    for (const t of timers) if (!t.done && now >= t.end) { t.done = true; alarm(); toast(`Timer done: ${t.label}`); }
    paintTimers();
  }, 1000);

  // ---- keep the screen on ----
  let lock = null;
  const wake = async () => { try { if ("wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen"); } catch {} };
  const onVis = () => { if (document.visibilityState === "visible") wake(); };
  document.addEventListener("visibilitychange", onVis); wake();

  const onKey = e => {
    if (e.target.closest?.("input, textarea")) return;
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(i + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  document.addEventListener("keydown", onKey);

  leave = () => { clearInterval(tick); document.removeEventListener("visibilitychange", onVis); document.removeEventListener("keydown", onKey); try { lock?.release(); } catch {} leave = null; };
  const onHash = () => { if (!location.hash.endsWith("/cook")) { leave?.(); window.removeEventListener("hashchange", onHash); } };
  window.addEventListener("hashchange", onHash);

  // ---- events ----
  app.querySelector(".cook").addEventListener("click", async e => {
    const s = e.target.closest("[data-step]"); if (s) return go(+s.dataset.step);
    const g = e.target.closest("[data-ing]");
    if (g) { const n = +g.dataset.ing; ticked.has(n) ? ticked.delete(n) : ticked.add(n); g.setAttribute("aria-pressed", ticked.has(n)); g.querySelector(".box").classList.toggle("on", ticked.has(n)); g.querySelector(".box").innerHTML = ticked.has(n) ? icon("check", true) : ""; return; }
    const t = e.target.closest("[data-timer]");
    if (t) { unlockAudio(); timers.push({ id: String(Date.now()), label: t.dataset.label, end: Date.now() + t.dataset.timer * 60000, done: false }); paintTimers(); toast(`${t.dataset.label} timer started.`); return; }
    const c = e.target.closest("[data-cancel]");
    if (c) { const k = timers.findIndex(x => x.id === c.dataset.cancel); const done = timers[k]?.done; if (done || confirm("Cancel this timer?")) { timers.splice(k, 1); paintTimers(); } return; }
    if (e.target.closest("[data-prev]")) return go(i - 1);
    if (e.target.closest("[data-next]")) {
      if (i < steps.length - 1) return go(i + 1);
      try { await data.markCooked(r.id); delete stepAt[id]; toast("Marked made. Nice."); location.hash = `#/recipe/${encodeURIComponent(r.id)}`; }
      catch (err) { console.error(err); toast("Couldn’t mark made — try again."); }
    }
  });
  paint(); paintTimers();
}

// "8 minutes", "about 2 hours", "10–15 min", "1 minute" → [{ min, text }]  (a range uses the shorter time)
export function findTimes(s) {
  const out = [], re = /(\d+)(?:\s*(?:–|-|to)\s*\d+)?\s*(hours?|hrs?|minutes?|mins?)\b/gi;
  for (const m of String(s).matchAll(re)) { const n = +m[1], hr = /^h/i.test(m[2]); const min = hr ? n * 60 : n;
    if (min > 0 && min <= 720 && !out.some(o => o.min === min)) out.push({ min, text: hr ? `${n} hr` : `${n} min` }); }
  return out;
}
const clock = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };

// A soft three-beep alarm + vibration. Audio has to be unlocked by a tap first (browser rule).
let ctx = null;
function unlockAudio() { try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch {} }
function alarm() {
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch {}
  if (!ctx) return;
  for (let k = 0; k < 3; k++) { const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + k * 0.5;
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4); }
}
