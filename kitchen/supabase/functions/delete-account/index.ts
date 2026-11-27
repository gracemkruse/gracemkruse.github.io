// Supabase Edge Function: delete-account
// Deletes the signed-in person's account and everything in it, for good: recipes, plans, pantry,
// lists, photos, profile and login. Only works on your own account (it reads who you are from
// your sign-in token). The service key lives only in Supabase's function settings.
//
// Request:  POST { confirm: "DELETE" }   (with the user's sign-in token)
// Response: { ok: true } or { error }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "DELETE") return send({ error: "Type DELETE to confirm." }, 400);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: who, error: e0 } = await admin.auth.getUser(token);
    if (e0 || !who?.user) return send({ error: "Sign in first." }, 401);
    const uid = who.user.id;

    // photos: everything in your folder
    const bucket = admin.storage.from("recipe-photos");
    for (;;) {
      const { data: files } = await bucket.list(uid, { limit: 1000 });
      if (!files?.length) break;
      await bucket.remove(files.map(f => `${uid}/${f.name}`));
      if (files.length < 1000) break;
    }
    // rows, in an order that respects the "still in use" rules between tables
    for (const t of ["meal_plan", "recipe_ingredients", "recipe_tags", "shopping_extras", "recipes", "ingredients", "tags", "units", "categories"])
      { const { error } = await admin.from(t).delete().eq("owner_id", uid); if (error) throw error; }
    await admin.from("invites").delete().eq("created_by", uid);
    await admin.from("ai_usage").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("id", uid);
    const { error: e1 } = await admin.auth.admin.deleteUser(uid); if (e1) throw e1;
    return send({ ok: true });
  } catch (e) {
    console.error(e);
    return send({ error: "Couldn’t delete the account. Nothing was lost; try again." }, 500);
  }
});
