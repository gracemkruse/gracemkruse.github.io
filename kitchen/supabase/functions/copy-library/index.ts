// Supabase Edge Function: copy-library  (one-off, removed after use)
// Copies the caller's whole recipe library into another account: Grace's library into her personal
// account and her mom's. Copies categories, tags, ingredients (stock reset to Out), recipes (archived
// included), their tags and ingredient lines, and the photos (copied inside storage, so no bandwidth).
// Not copied: meal plans and hand-added shopping items.
// Only someone allowed to invite can run it, and only into an account that has no recipes yet.
//
// Request:  POST { to_email }   (with the caller's sign-in token)
// Response: { ok: true, recipes, ingredients, photos } or { error }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const PHOTO = "/storage/v1/object/public/recipe-photos/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { to_email } = await req.json();
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: who } = await db.auth.getUser(token);
    const from = who?.user?.id; if (!from) return send({ error: "Sign in first." }, 401);
    const { data: prof } = await db.from("profiles").select("can_invite").eq("id", from).maybeSingle();
    if (!prof?.can_invite) return send({ error: "Only Grace can copy a library." }, 403);

    // find the target account by email
    let to = "";
    for (let page = 1; !to; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 }); if (error) throw error;
      to = data.users.find(u => (u.email || "").toLowerCase() === String(to_email || "").trim().toLowerCase())?.id || "";
      if (data.users.length < 200) break;
    }
    if (!to) return send({ error: "No account with that email yet. They need to join first." }, 404);
    if (to === from) return send({ error: "That’s your own account." }, 400);
    const { count } = await db.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", to);
    if (count) return send({ error: "That account already has recipes, so nothing was copied." }, 409);

    const all = async (table: string, cols: string) => {
      const out: any[] = [];
      for (let i = 0; ; i += 1000) { const { data, error } = await db.from(table).select(cols).eq("owner_id", from).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
    };
    const insert = async (table: string, rows: any[]) => { for (let i = 0; i < rows.length; i += 500) { const { error } = await db.from(table).insert(rows.slice(i, i + 500)); if (error) throw error; } };
    const id = () => crypto.randomUUID();

    // lookups: categories, tags, units (match the target's existing ones by name)
    const remap = async (table: string, cols: string) => {
      const src = await all(table, "id,name_norm," + cols);
      const { data: have } = await db.from(table).select("id,name_norm").eq("owner_id", to);
      const byNorm = new Map((have || []).map((r: any) => [r.name_norm, r.id]));
      const map = new Map<string, string>(); const rows: any[] = [];
      for (const r of src) { const hit = byNorm.get(r.name_norm); if (hit) { map.set(r.id, hit); continue; }
        const nid = id(); map.set(r.id, nid); const { id: _i, name_norm: _n, ...rest } = r; rows.push({ ...rest, id: nid, owner_id: to }); }
      await insert(table, rows); return map;
    };
    const cat = await remap("categories", "name,icon,sort");
    const tag = await remap("tags", "name,sort");
    await remap("units", "name");

    // ingredients: same names, stock reset to Out
    const ings = await all("ingredients", "id,name,category_id,icon");
    const ing = new Map<string, string>();
    await insert("ingredients", ings.map(r => { const nid = id(); ing.set(r.id, nid);
      return { id: nid, owner_id: to, name: r.name, category_id: r.category_id ? cat.get(r.category_id) || null : null, icon: r.icon, stock_status: "out", in_cart: false }; }));

    // photos: copy each file into the new account's folder
    let photos = 0;
    const copyPhoto = async (url: string | null) => {
      if (!url || !url.startsWith(URL_ + PHOTO)) return url;   // outside links stay as they are
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

    return send({ ok: true, recipes: rows.length, ingredients: ings.length, photos });
  } catch (e) {
    console.error(e);
    return send({ error: "Copy stopped partway: " + ((e as Error).message || e) }, 500);
  }
});
