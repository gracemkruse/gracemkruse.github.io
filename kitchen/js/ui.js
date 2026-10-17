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

export const pref = {
  get(k, d) { try { return localStorage.getItem("kitchen-pref-" + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("kitchen-pref-" + k, v); } catch {} },
};
