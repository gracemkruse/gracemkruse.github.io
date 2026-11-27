// Join from an invite link: #/join/<code>. Name and email; birth year and gender optional.
// Then a 6-digit code (shared code screen) finishes it. Under 13 can't join.
import * as data from "../data.js";
import { icon } from "../icons.js";
import { $, esc } from "../ui.js";
import { codeView } from "./login.js";

const GENDERS = ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"];

export function joinView(code, app) {
  app.innerHTML = `
    <form class="login join" autocomplete="on" novalidate>
      <div>
        <div class="t-label grey">Invited by Grace</div>
        <h1 class="t-page" style="margin:8px 0 0">Join Kitchen</h1>
      </div>
      <p class="t-instr">Your recipes, your week and your shopping list in one place. You’ll start with a few favourite recipes and a pantry of everyday basics.</p>
      <label class="input-line"><input class="t-item" name="name" placeholder="Your name" autocomplete="given-name" required></label>
      <label class="input-line"><input class="t-item" type="email" name="email" placeholder="Email" autocomplete="email" inputmode="email" required></label>
      <div class="join-optional">
        <div class="t-label grey">Optional</div>
        <label class="input-line"><input class="t-item" name="year" placeholder="Birth year" inputmode="numeric" maxlength="4" autocomplete="bday-year"></label>
        <label class="input-line select-line"><select class="t-item" name="gender" aria-label="Gender">
          <option value="">Gender</option>${GENDERS.map(g => `<option>${esc(g)}</option>`).join("")}
        </select>${icon("down")}</label>
        <p class="t-instr grey">Helps Grace understand who uses Kitchen. Change or clear it any time in Settings.</p>
      </div>
      <p class="error t-label" aria-live="assertive"></p>
      <button class="btn-primary t-label" type="submit">Send code</button>
      <a class="btn-text grey t-label" href="#/privacy">Privacy</a>
    </form>`;
  const form = $(".login", app), err = $(".error", app), btn = $('button[type="submit"]', form);
  const gender = form.gender; const tint = () => gender.classList.toggle("grey", !gender.value); gender.onchange = tint; tint();
  form.name.focus();
  form.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = ""; btn.disabled = true;
    const email = form.email.value.trim();
    try {
      await data.join({ code, email, name: form.name.value, birth_year: form.year.value.trim(), gender: form.gender.value });
      codeView(app, email, { label: "Join Kitchen", after: () => { location.hash = "#/recipes"; } });
    } catch (ex) {
      if (ex.code === "used" || ex.code === "expired") return usedView(app, ex.code);
      err.textContent = ex.message; btn.disabled = false;
    }
  });
}

function usedView(app, why) {
  app.innerHTML = `
    <div class="login">
      <div>
        <div class="t-label grey">Kitchen</div>
        <h1 class="t-page" style="margin:8px 0 0">${why === "expired" ? "This invite has expired" : "This invite has been used"}</h1>
      </div>
      <p class="t-instr">Each invite link works once and lasts 14 days. Ask Grace for a new one, or sign in if this was you.</p>
      <a class="btn-primary t-label" href="#/login">Sign in</a>
    </div>`;
}

export function privacyView(app) {
  const back = history.length > 1;
  app.innerHTML = `
    <section class="settings privacy">
      <button class="btn-text grey t-label back" type="button" data-back>${icon("back", true)} Back</button>
      <h1 class="t-page page-title">Privacy</h1>
      ${[["What Kitchen keeps", "Your email and name, your recipes, photos, meal plans and pantry. Birth year and gender only if you add them."],
         ["Why", "To run your kitchen, and so Grace can understand who uses it. Nothing is sold or shared, and there are no ads."],
         ["Who can see it", "Only you can see your recipes and lists. Grace can see account details (name, email, birth year, gender) to run the app."],
         ["Your choices", "Change or clear your details in Settings. Download your recipes any time. Delete account removes everything, for good."]]
        .map(([h, b]) => `<h2 class="t-label grey set-head">${h}</h2><p class="t-instr">${b}</p>`).join("")}
    </section>`;
  $("[data-back]", app).onclick = () => (back ? history.back() : (location.hash = "#/login"));
}
