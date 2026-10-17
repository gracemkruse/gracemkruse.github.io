// Small UI helpers shared by the views.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

export function minutes(m) {
  if (!m) return "";
  if (m < 60) return `${m}′`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r}′` : `${h} hr`;
}

// "2 tbsp", "½ cup", "1" — keep fractions friendly
export function amount(a, unit) {
  if (a == null && !unit) return "";
  const FR = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" };
  let n = "";
  if (a != null) { const whole = Math.floor(a), frac = Math.round((a - whole) * 100) / 100; n = (whole ? String(whole) : "") + (FR[frac] || (frac ? String(frac).replace(/^0/, "") : "")); if (!n) n = "0"; }
  return [n, unit].filter(Boolean).join(" ");
}

// Warm gradient placeholder until a real photo is added (stable per recipe).
const TONES = [["#7E2F22", "#E0A07A"], ["#6B3A22", "#D49A63"], ["#4F5A2E", "#C2C08A"], ["#5A4632", "#D2B48C"], ["#3E4A3A", "#B5B99A"], ["#7A5530", "#E6C28E"]];
export function photoStyle(r) {
  if (r.image_url) return `background-image:url('${esc(r.image_url)}')`;
  let h = 0; for (const c of String(r.id || r.title)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = TONES[h % TONES.length];
  return `background-image:linear-gradient(160deg, ${a}, ${b})`;
}

// ---------- Dates (local, Monday-start weeks) ----------
export function iso(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
export function fromIso(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function weekStart(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); }
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function dayLabel(d) { return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()}`; }
export function rangeLabel(start) { const end = addDays(start, 6); return start.getMonth() === end.getMonth() ? `${MON[start.getMonth()]} ${start.getDate()} — ${end.getDate()}` : `${MON[start.getMonth()]} ${start.getDate()} — ${MON[end.getMonth()]} ${end.getDate()}`; }
export function monthDay(d) { return `${MON[d.getMonth()]} ${d.getDate()}`; }

// ---------- Bottom sheet ----------
export function sheet(innerHtml, label) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet-scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${innerHtml}</div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  return { el: wrap.querySelector(".sheet"), close };
}

export const pref = {
  get(k, d) { try { return localStorage.getItem("kitchen-pref-" + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("kitchen-pref-" + k, v); } catch {} },
};
