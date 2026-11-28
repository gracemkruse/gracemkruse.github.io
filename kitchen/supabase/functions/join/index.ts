// Supabase Edge Function: join
// Turns a valid invite into a new account. Called from the Join screen before anyone is signed in,
// so it's protected by the invite itself: unused, not expired, and only usable once.
// If the invite says so, the new account starts with a copy of the inviter's library
// (recipes, tags, ingredients, photos; meal plans too when asked) instead of the starter recipes.
// New accounts can only be made here: "Allow new users to sign up" is off in Supabase Auth.
// The service key it uses lives only in Supabase's function settings, never in the app.
//
// Request:  POST { code, email, name, birth_year?, gender? }
// Response: { ok: true, library? } (then the app emails a sign-in code), or { error } with 400/404/409/410
// Group links (max_uses > 1, up to 10) work for several people until full, expired or stopped; never with a library.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const GENDERS = ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"];
const PHOTO = "/storage/v1/object/public/recipe-photos/";

// Copy one account's library into another (service role). Stock resets to Out; photos are copied inside storage.
async function copyLibrary(db: any, URL_: string, from: string, to: string, meals: boolean) {
  const all = async (table: string, cols: string) => {
    const out: any[] = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await db.from(table).select(cols).eq("owner_id", from).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
  };
  const insert = async (table: string, rows: any[]) => { for (let i = 0; i < rows.length; i += 500) { const { error } = await db.from(table).insert(rows.slice(i, i + 500)); if (error) throw error; } };
  const id = () => crypto.randomUUID();
  const remap = async (table: string, cols: string) => {
    const src = await all(table, "id,name_norm," + cols);
    const { data: have } = await db.from(table).select("id,name_norm").eq("owner_id", to);
    const byNorm = new Map((have || []).map((r: any) => [r.name_norm, r.id]));
    const map = new Map<string, string>(); const rows: any[] = [];
    for (const r of src) { const hit = byNorm.get(r.name_norm); if (hit) { map.set(r.id, hit as string); continue; }
      const nid = id(); map.set(r.id, nid); const { id: _i, name_norm: _n, ...rest } = r; rows.push({ ...rest, id: nid, owner_id: to }); }
    await insert(table, rows); return map;
  };
  const cat = await remap("categories", "name,icon,sort");
  const tag = await remap("tags", "name,sort");
  await remap("units", "name");
  const ings = await all("ingredients", "id,name,category_id,icon");
  const ing = new Map<string, string>();
  await insert("ingredients", ings.map(r => { const nid = id(); ing.set(r.id, nid);
    return { id: nid, owner_id: to, name: r.name, category_id: r.category_id ? cat.get(r.category_id) || null : null, icon: r.icon, stock_status: "out", in_cart: false }; }));
  let photos = 0;
  const copyPhoto = async (url: string | null) => {
    if (!url || !url.startsWith(URL_ + PHOTO)) return url;
    const src = decodeURIComponent(url.slice((URL_ + PHOTO).length)); const dst = `${to}/${id()}.jpg`;
    const { error } = await db.storage.from("recipe-photos").copy(src, dst);
    if (error) { console.warn("photo not copied", src, error.message); return url; }
    photos++; return db.storage.from("recipe-photos").getPublicUrl(dst).data.publicUrl;
  };
  const recs = await all("recipes", "id,title,image_url,image_thumb,servings,total_minutes,steps,notes,source_url,source_notes,archived_at,created_at");
  const rec = new Map<string, string>(); const rows: any[] = [];
  for (const r of recs) { const nid = id(); rec.set(r.id, nid);
    rows.push({ ...r, id: nid, owner_id: to, image_url: await copyPhoto(r.image_url), image_thumb: await copyPhoto(r.image_thumb) }); }
  await insert("recipes", rows);
  const rt = await all("recipe_tags", "recipe_id,tag_id");
  await insert("recipe_tags", rt.filter(x => rec.has(x.recipe_id) && tag.has(x.tag_id)).map(x => ({ recipe_id: rec.get(x.recipe_id), tag_id: tag.get(x.tag_id), owner_id: to })));
  const ri = await all("recipe_ingredients", "recipe_id,ingredient_id,amount,unit,prep,position");
  await insert("recipe_ingredients", ri.filter(x => rec.has(x.recipe_id) && ing.has(x.ingredient_id)).map(x => ({ ...x, id: id(), owner_id: to, recipe_id: rec.get(x.recipe_id), ingredient_id: ing.get(x.ingredient_id) })));
  let mealCount = 0;
  if (meals) {
    const mp = await all("meal_plan", "plan_date,recipe_id,status,created_at");
    const keep = mp.filter(m => rec.has(m.recipe_id)).map(m => ({ ...m, id: id(), owner_id: to, recipe_id: rec.get(m.recipe_id) }));
    await insert("meal_plan", keep); mealCount = keep.length;
  }
  return { recipes: rows.length, ingredients: ings.length, photos, meals: mealCount };
}

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

    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: inv } = await admin.from("invites").select("code,created_by,used_by,expires_at,with_library,with_meals,max_uses,uses").eq("code", code).maybeSingle();
    if (!inv) return send({ error: "That invite link doesn’t work. Ask Grace for a new one." }, 404);
    const group = (inv.max_uses || 1) > 1;
    if (new Date(inv.expires_at) < new Date()) return send({ error: "expired" }, 410);
    if (group ? inv.uses >= inv.max_uses : inv.used_by) return send({ error: group ? "full" : "used" }, 410);

    const { data: made, error: e1 } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
    if (e1) {
      if (/already|registered|exists/i.test(e1.message)) return send({ error: "That email already has an account. Sign in instead." }, 409);
      throw e1;
    }
    const id = made.user.id;
    // claim the invite first (only if still free, in case two people raced)
    if (group) {
      let ok = false;
      for (let n = inv.uses, tries = 0; tries < 5 && n < inv.max_uses; tries++) {
        const { data: c } = await admin.from("invites").update({ uses: n + 1, used_at: new Date().toISOString() }).eq("code", code).eq("uses", n).select("code");
        if (c?.length) { ok = true; break; }
        const { data: fresh } = await admin.from("invites").select("uses").eq("code", code).single(); n = fresh?.uses ?? inv.max_uses;
      }
      if (!ok) { await admin.auth.admin.deleteUser(id); return send({ error: "full" }, 410); }
      await admin.from("invite_joins").insert({ code, user_id: id, name });
    } else {
      const { data: claimed } = await admin.from("invites").update({ used_by: id, used_at: new Date().toISOString(), uses: 1 }).eq("code", code).is("used_by", null).select("code");
      if (!claimed?.length) { await admin.auth.admin.deleteUser(id); return send({ error: "used" }, 410); }
    }
    // with the inviter's library: no starter recipes or staples (seeded now); otherwise the app adds them on first sign-in
    const { error: e2 } = await admin.from("profiles").insert({ id, display_name: name, birth_year: year, gender, seeded_at: inv.with_library && !group ? new Date().toISOString() : null });
    if (e2) throw e2;
    let library = null;
    if (inv.with_library && !group) library = await copyLibrary(admin, URL_, inv.created_by, id, !!inv.with_meals);
    return send({ ok: true, library });
  } catch (e) {
    console.error(e);
    return send({ error: "Something went wrong. Try again in a minute." }, 500);
  }
});
