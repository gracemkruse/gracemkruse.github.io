// Supabase Edge Function: join
// Turns a valid invite into a new account. Called from the Join screen before anyone is signed in,
// so it's protected by the invite itself: unused, not expired, and only usable once.
// New accounts can only be made here: "Allow new users to sign up" is off in Supabase Auth.
// The service key it uses lives only in Supabase's function settings, never in the app.
//
// Request:  POST { code, email, name, birth_year?, gender? }
// Response: { ok: true } (then the app emails a sign-in code), or { error } with 400/404/409/410

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const GENDERS = ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const code = String(b.code || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim().slice(0, 60);
    const year = b.birth_year ? Number(b.birth_year) : null;
    const gender = b.gender && GENDERS.includes(String(b.gender)) ? String(b.gender) : null;
    if (!code) return send({ error: "This invite link is missing its code." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send({ error: "That email doesn’t look right." }, 400);
    if (!name) return send({ error: "Add your name." }, 400);
    const now = new Date().getFullYear();
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > now)) return send({ error: "That birth year doesn’t look right." }, 400);
    if (year !== null && now - year < 13) return send({ error: "Kitchen is for ages 13 and up." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: inv } = await admin.from("invites").select("code,used_by,expires_at").eq("code", code).maybeSingle();
    if (!inv) return send({ error: "That invite link doesn’t work. Ask Grace for a new one." }, 404);
    if (inv.used_by) return send({ error: "used" }, 410);
    if (new Date(inv.expires_at) < new Date()) return send({ error: "expired" }, 410);

    const { data: made, error: e1 } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
    if (e1) {
      if (/already|registered|exists/i.test(e1.message)) return send({ error: "That email already has an account. Sign in instead." }, 409);
      throw e1;
    }
    const id = made.user.id;
    const { error: e2 } = await admin.from("profiles").insert({ id, display_name: name, birth_year: year, gender });
    if (e2) throw e2;
    // mark used (only if still unused, in case two people raced)
    await admin.from("invites").update({ used_by: id, used_at: new Date().toISOString() }).eq("code", code).is("used_by", null);
    return send({ ok: true });
  } catch (e) {
    console.error(e);
    return send({ error: "Something went wrong. Try again in a minute." }, 500);
  }
});
