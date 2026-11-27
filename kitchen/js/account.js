// Your initial, top right of Recipes, This Week and the Shopping List. Tap → a small menu:
// Settings · Sign out. (How it works joins once the tour is built.)
import * as data from "./data.js";
import { esc } from "./ui.js";

let me = null;   // { email, name } for this session
async function who() { return (me ||= await data.me()); }

export function accountButton() {
  return `<button class="account-btn t-label" type="button" data-account aria-label="Account menu" aria-haspopup="menu"><span data-initial></span></button>`;
}

export async function wireAccount(root) {
  const btn = root.querySelector("[data-account]"); if (!btn) return;
  const m = await who();
  btn.querySelector("[data-initial]").textContent = (m.name || m.email || "·").trim().charAt(0).toUpperCase();
  btn.onclick = () => openMenu(btn, m);
}

function openMenu(btn, m) {
  const wrap = document.createElement("div");
  wrap.className = "account-wrap";
  const r = btn.getBoundingClientRect();
  wrap.innerHTML = `<div class="account-scrim" data-close></div>
    <div class="account-menu" role="menu" style="top:${Math.round(r.bottom + 8)}px;right:${Math.round(window.innerWidth - r.right)}px">
      <div class="account-who">${m.name ? `<div class="t-item">${esc(m.name)}</div>` : ""}<div class="t-label grey">${esc(m.email || "")}</div></div>
      <a class="t-item" role="menuitem" href="#/settings">Settings</a>
      <button class="t-item grey" role="menuitem" type="button" data-signout>Sign out</button>
    </div>`;
  document.body.appendChild(wrap);
  btn.setAttribute("aria-expanded", "true");
  const close = () => { wrap.remove(); btn.setAttribute("aria-expanded", "false"); document.removeEventListener("keydown", onKey); window.removeEventListener("hashchange", close); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", close);
  wrap.querySelector("[data-close]").onclick = close;
  wrap.querySelectorAll("a[role=menuitem]").forEach(a => a.addEventListener("click", close));
  wrap.querySelector("[data-signout]").onclick = async () => { close(); await data.signOut(); me = null; location.hash = "#/login"; };
}
