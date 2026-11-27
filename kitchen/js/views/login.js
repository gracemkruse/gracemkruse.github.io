// Sign in: email → a 6-digit code from your inbox. No passwords.
// The code screen is shared with Join (after an invite, a code finishes the sign-up).
import * as data from "../data.js";
import { $, esc, toast } from "../ui.js";

export function loginView(app) {
  app.innerHTML = `
    <form class="login" autocomplete="on" novalidate>
      <div>
        <div class="t-label grey">Kitchen</div>
        <h1 class="t-page" style="margin:8px 0 0">Welcome in</h1>
      </div>
      <label class="input-line"><input class="t-item" type="email" name="email" placeholder="Email" autocomplete="email" inputmode="email" required></label>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Send code</button>
      <p class="t-instr grey">We’ll email you a 6-digit code. No password to remember.</p>
      ${data.isDemo ? `<p class="t-label grey">Demo mode: any email and code work.</p>` : ""}
    </form>`;
  const form = $(".login", app), err = $(".error", app), btn = $("button", form);
  form.email.focus();
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = ""; btn.disabled = true;
    try { await data.sendCode(form.email.value); codeView(app, form.email.value.trim()); }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
}

// Step 2: type the code. iPhone offers it from Mail (autocomplete="one-time-code").
export function codeView(app, email, { label = "Kitchen", after = () => { location.hash = "#/recipes"; } } = {}) {
  app.innerHTML = `
    <form class="login" autocomplete="on" novalidate>
      <div>
        <div class="t-label grey">${esc(label)}</div>
        <h1 class="t-page" style="margin:8px 0 0">Check your email</h1>
      </div>
      <p class="t-instr">We sent a 6-digit code to ${esc(email)}. It works for an hour.</p>
      <label class="code-slots" aria-label="6-digit code">
        <input class="t-item" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required>
        <span aria-hidden="true">${"<i></i>".repeat(6)}</span>
      </label>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Sign in</button>
      <div class="login-actions">
        <button class="btn-text t-label" type="button" data-resend>Send a new code</button>
        <button class="btn-text grey t-label" type="button" data-other>Use a different email</button>
      </div>
    </form>`;
  const form = $(".login", app), err = $(".error", app), btn = $('button[type="submit"]', form);
  const input = form.code, slots = [...app.querySelectorAll(".code-slots i")];
  const paint = () => { const v = input.value.replace(/\D/g, "").slice(0, 6); if (v !== input.value) input.value = v;
    slots.forEach((s, i) => { s.textContent = v[i] || ""; s.classList.toggle("on", i < v.length); s.classList.toggle("next", i === v.length && document.activeElement === input); }); };
  input.addEventListener("input", () => { paint(); if (input.value.length === 6) form.requestSubmit(); });
  input.addEventListener("focus", paint); input.addEventListener("blur", paint);
  input.focus(); paint();
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = ""; btn.disabled = true;
    try { await data.verifyCode(email, input.value); after(); }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; input.select(); }
  });
  $("[data-resend]", app).onclick = async () => { try { await data.sendCode(email); toast("New code sent."); } catch (ex) { err.textContent = ex.message; } };
  $("[data-other]", app).onclick = () => loginView(app);
}
