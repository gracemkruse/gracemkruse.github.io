import * as data from "../data.js";
import { $ } from "../ui.js";

export function loginView(app) {
  app.innerHTML = `
    <form class="login" autocomplete="on">
      <div>
        <div class="t-label grey">Kitchen</div>
        <h1 class="t-page" style="margin:8px 0 0">Welcome in</h1>
      </div>
      <input type="text" name="username" value="kitchen" autocomplete="username" hidden>
      <label class="input-line">
        <input class="t-item" type="password" name="password" placeholder="Household password" autocomplete="current-password" required>
      </label>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Enter</button>
      ${data.isDemo ? `<p class="t-label grey">Demo mode — any password works.</p>` : ""}
    </form>`;
  const form = $(".login", app), err = $(".error", app), btn = $("button", form);
  $('input[name="password"]', form).focus();
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = ""; btn.disabled = true;
    try { await data.signIn(form.password.value); location.hash = "#/recipes"; }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
}
