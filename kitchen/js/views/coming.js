import { esc } from "../ui.js";

export function comingView(app, title, body) {
  app.innerHTML = `
    <section class="coming">
      <div class="t-label grey">Coming next</div>
      <h1 class="t-page page-title" style="margin-top:8px">${esc(title)}</h1>
      <hr class="rule ink">
      <p class="t-item">${esc(body)}</p>
    </section>`;
}
