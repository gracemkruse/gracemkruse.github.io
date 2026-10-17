// Data layer. One interface, two backends:
//   • Supabase (real, shared across devices) when config.js has a URL + key
//   • Demo (sample recipes in localStorage) otherwise
import { SUPABASE_URL, SUPABASE_ANON_KEY, HOUSEHOLD_EMAIL } from "./config.js";

export const isDemo = !(SUPABASE_URL && SUPABASE_ANON_KEY);
let sb = null;

export async function init() {
  if (isDemo) return;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}

// ---------------- Auth ----------------
const DEMO_SESSION = "kitchen-demo-session";

export async function hasSession() {
  if (isDemo) return safeGet(DEMO_SESSION) === "1";
  const { data } = await sb.auth.getSession();
  return !!data.session;
}

export async function signIn(password) {
  if (isDemo) {
    if (!password) throw new Error("Enter the household password.");
    safeSet(DEMO_SESSION, "1"); return;
  }
  const { error } = await sb.auth.signInWithPassword({ email: HOUSEHOLD_EMAIL, password });
  if (error) throw new Error("That password didn’t work.");
}

export async function signOut() {
  if (isDemo) { safeDel(DEMO_SESSION); return; }
  await sb.auth.signOut();
}

// ---------------- Recipes ----------------
// Recipe shape used by the views:
// { id, title, image_url, servings, total_minutes, steps: [], notes, source_url, source_notes,
//   tags: [names], ingredients: [{ amount, unit, name, prep, stock_status }] }

export async function listRecipes() {
  if (isDemo) return demo().recipes.filter(r => !r.archived_at).map(summary).sort(byTitle);
  const { data, error } = await sb.from("recipes")
    .select("id,title,image_url,servings,total_minutes,recipe_tags(tags(name))")
    .is("archived_at", null).order("title");
  if (error) throw error;
  return data.map(r => ({ ...r, tags: (r.recipe_tags || []).map(x => x.tags?.name).filter(Boolean) }));
}

export async function listTags() {
  if (isDemo) return [...new Set(demo().recipes.filter(r => !r.archived_at).flatMap(r => r.tags))].sort();
  const { data, error } = await sb.from("tags").select("name,sort").order("sort").order("name");
  if (error) throw error;
  return data.map(t => t.name);
}

export async function getRecipe(id) {
  if (isDemo) {
    const db = demo(), r = db.recipes.find(x => x.id === id); if (!r) return null;
    const out = structuredClone(r), p = demoPantry(db);
    for (const g of out.ingredients) g.stock_status = p[norm(g.name)]?.stock_status || g.stock_status;
    return out;
  }
  const { data, error } = await sb.from("recipes")
    .select("*, recipe_tags(tags(name)), recipe_ingredients(amount,unit,prep,position, ingredients(name,stock_status))")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    tags: (data.recipe_tags || []).map(x => x.tags?.name).filter(Boolean),
    ingredients: (data.recipe_ingredients || []).sort((a, b) => a.position - b.position)
      .map(x => ({ amount: x.amount, unit: x.unit, prep: x.prep, name: x.ingredients?.name || "", stock_status: x.ingredients?.stock_status || "not_tracked" })),
  };
}

export async function saveRecipe(input) {
  const r = clean(input);
  if (isDemo) {
    const db = demo();
    r.tags = canonical(r.tags, db.recipes.filter(x => x.id !== r.id).flatMap(x => x.tags));
    if (r.id) { const i = db.recipes.findIndex(x => x.id === r.id); db.recipes[i] = { ...db.recipes[i], ...r }; }
    else { r.id = uid(); r.created_at = new Date().toISOString(); db.recipes.push(r); }
    // de-dup ingredient names case-insensitively, carrying stock status across recipes
    const status = {}; for (const x of db.recipes) for (const g of x.ingredients) status[norm(g.name)] ??= g.stock_status;
    for (const g of r.ingredients) g.stock_status = status[norm(g.name)] || "not_tracked";
    saveDemo(db); return r.id;
  }
  const row = { title: r.title, image_url: r.image_url, servings: r.servings, total_minutes: r.total_minutes, steps: r.steps, notes: r.notes, source_url: r.source_url, source_notes: r.source_notes };
  let id = r.id;
  if (id) { const { error } = await sb.from("recipes").update(row).eq("id", id); if (error) throw error; }
  else { const { data, error } = await sb.from("recipes").insert(row).select("id").single(); if (error) throw error; id = data.id; }
  // tags (unique per owner by normalized name)
  await sb.from("recipe_tags").delete().eq("recipe_id", id);
  if (r.tags.length) {
    const { data: existing } = await sb.from("tags").select("name");
    r.tags = canonical(r.tags, (existing || []).map(t => t.name));
    const { data: tags, error } = await sb.from("tags").upsert(r.tags.map(name => ({ name })), { onConflict: "owner_id,name_norm" }).select("id");
    if (error) throw error;
    const { error: e2 } = await sb.from("recipe_tags").insert(tags.map(t => ({ recipe_id: id, tag_id: t.id }))); if (e2) throw e2;
  }
  // ingredients (de-duplicated: "Cherry tomatoes" and "cherry tomatoes" are one ingredient)
  await sb.from("recipe_ingredients").delete().eq("recipe_id", id);
  if (r.ingredients.length) {
    const names = [...new Map(r.ingredients.map(g => [norm(g.name), g.name])).values()];
    const { data: ings, error } = await sb.from("ingredients").upsert(names.map(name => ({ name })), { onConflict: "owner_id,name_norm", ignoreDuplicates: false }).select("id,name_norm");
    if (error) throw error;
    const idByNorm = Object.fromEntries(ings.map(x => [x.name_norm, x.id]));
    const lines = r.ingredients.map((g, i) => ({ recipe_id: id, ingredient_id: idByNorm[norm(g.name)], amount: g.amount, unit: g.unit, prep: g.prep, position: i }));
    const { error: e3 } = await sb.from("recipe_ingredients").insert(lines); if (e3) throw e3;
  }
  return id;
}

export async function archiveRecipe(id) {
  const at = new Date().toISOString();
  if (isDemo) { const db = demo(); const r = db.recipes.find(x => x.id === id); if (r) r.archived_at = at; saveDemo(db); return; }
  const { error } = await sb.from("recipes").update({ archived_at: at }).eq("id", id);
  if (error) throw error;
}

// ---------------- This Week (meal plan) ----------------
// Item shape: { id, date: "YYYY-MM-DD", status: "planned"|"made"|"skipped", recipe: { id, title, total_minutes, tags } }

export async function listWeek(start, end) {
  if (isDemo) {
    const db = demo(), byId = Object.fromEntries(db.recipes.map(r => [r.id, r]));
    return (db.meal_plan || []).filter(m => m.date >= start && m.date <= end && byId[m.recipe_id])
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
      .map(m => ({ id: m.id, date: m.date, status: m.status, recipe: summary(byId[m.recipe_id]) }));
  }
  const { data, error } = await sb.from("meal_plan")
    .select("id,plan_date,status,created_at,recipes(id,title,total_minutes,recipe_tags(tags(name)))")
    .gte("plan_date", start).lte("plan_date", end).order("plan_date").order("created_at");
  if (error) throw error;
  return data.filter(m => m.recipes).map(m => ({ id: m.id, date: m.plan_date, status: m.status,
    recipe: { id: m.recipes.id, title: m.recipes.title, total_minutes: m.recipes.total_minutes, tags: (m.recipes.recipe_tags || []).map(x => x.tags?.name).filter(Boolean) } }));
}

export async function addToWeek(recipeId, date) {
  if (isDemo) { const db = demo(); (db.meal_plan ||= []).push({ id: uid(), recipe_id: recipeId, date, status: "planned", created_at: new Date().toISOString() }); saveDemo(db); return; }
  const { error } = await sb.from("meal_plan").insert({ recipe_id: recipeId, plan_date: date }); if (error) throw error;
}

export async function setMealStatus(id, status) {
  if (isDemo) { const db = demo(); const m = (db.meal_plan || []).find(x => x.id === id); if (m) m.status = status; saveDemo(db); return; }
  const { error } = await sb.from("meal_plan").update({ status }).eq("id", id); if (error) throw error;
}

export async function removeFromWeek(id) {
  if (isDemo) { const db = demo(); db.meal_plan = (db.meal_plan || []).filter(x => x.id !== id); saveDemo(db); return; }
  const { error } = await sb.from("meal_plan").delete().eq("id", id); if (error) throw error;
}

// Times made = meals marked "made" (computed, never a separate counter that can drift).
export async function timesMade(recipeId) {
  if (isDemo) return (demo().meal_plan || []).filter(m => m.recipe_id === recipeId && m.status === "made").length;
  const { count, error } = await sb.from("meal_plan").select("id", { count: "exact", head: true }).eq("recipe_id", recipeId).eq("status", "made");
  if (error) throw error;
  return count || 0;
}

// Copy a past week's meals into another week (same weekdays), as planned.
export async function copyWeek(items, dayShift) {
  const shifted = items.map(m => ({ recipe_id: m.recipe.id, date: shiftDate(m.date, dayShift) }));
  if (isDemo) { const db = demo(); for (const s of shifted) (db.meal_plan ||= []).push({ id: uid(), recipe_id: s.recipe_id, date: s.date, status: "planned", created_at: new Date().toISOString() }); saveDemo(db); return; }
  if (!shifted.length) return;
  const { error } = await sb.from("meal_plan").insert(shifted.map(s => ({ recipe_id: s.recipe_id, plan_date: s.date }))); if (error) throw error;
}
// Finished cooking: mark today's planned meal made, or log it on today if it wasn't planned.
export async function markCooked(recipeId) {
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (isDemo) {
    const db = demo(), m = (db.meal_plan ||= []).find(x => x.recipe_id === recipeId && x.date === today && x.status !== "made");
    if (m) m.status = "made"; else db.meal_plan.push({ id: uid(), recipe_id: recipeId, date: today, status: "made", created_at: new Date().toISOString() });
    saveDemo(db); return;
  }
  const { data, error } = await sb.from("meal_plan").select("id").eq("recipe_id", recipeId).eq("plan_date", today).neq("status", "made").limit(1);
  if (error) throw error;
  const r = data.length ? await sb.from("meal_plan").update({ status: "made" }).eq("id", data[0].id)
                        : await sb.from("meal_plan").insert({ recipe_id: recipeId, plan_date: today, status: "made" });
  if (r.error) throw r.error;
}

// ---------------- Photos ----------------
// Shrinks the photo in the browser first (phone photos are huge), then stores it.
// Supabase: public "recipe-photos" bucket, one folder per account. Demo: a small data URL.
export async function uploadPhoto(file) {
  const blob = await shrink(file, isDemo ? 800 : 1600);
  if (isDemo) return await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(blob); });
  const { data: s } = await sb.auth.getSession(); const user = s.session?.user?.id; if (!user) throw new Error("Not signed in.");
  const path = `${user}/${uid()}.jpg`;
  const { error } = await sb.storage.from("recipe-photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(/bucket/i.test(error.message) ? "Photo storage isn’t set up yet (run migration 003)." : error.message);
  return sb.storage.from("recipe-photos").getPublicUrl(path).data.publicUrl;
}
async function shrink(file, max) {
  const img = await (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: "from-image" }) : new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That file isn’t an image we can read.")); i.src = URL.createObjectURL(file); }));
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error("Couldn’t read that photo."))), "image/jpeg", 0.85));
}

// ---------------- Shopping List ----------------
// Category order matches the store walk: Produce → Protein → Dairy → Pantry → Herbs & Spices → Household.
export const CATEGORIES = [
  { name: "Produce", icon: "produce", sort: 1 }, { name: "Protein", icon: "protein", sort: 2 }, { name: "Dairy", icon: "dairy", sort: 3 },
  { name: "Pantry", icon: "pantry", sort: 4 }, { name: "Herbs & Spices", icon: "herbs", sort: 5 }, { name: "Household", icon: "household", sort: 6 },
];
const GUESS = [
  ["Pantry", /\b(crushed|canned|paste|dried|stock|broth|flour|sugar|oil|vinegar|coffee|tea|rice|pasta|oats|cereal|honey|bread)\b/], // checked first: "crushed tomatoes" is a can, not produce
  ["Herbs & Spices", /\b(cumin|paprika|peppercorns|black pepper|salt|oregano|thyme|rosemary|basil|parsley|cilantro|dill|mint|sage|bay|cinnamon|nutmeg|chili|chile flakes|turmeric|coriander|curry|vanilla|spices?)\b/],
  ["Produce", /\b(onions?|garlic|shallots?|lemons?|limes?|oranges?|apples?|bananas?|berries|tomato(es)?|potato(es)?|carrots?|celery|peppers?|zucchini|squash|spinach|kale|lettuce|greens|arugula|cabbage|broccoli|cauliflower|mushrooms?|cucumbers?|avocados?|scallions?|leeks?|ginger|herbs?|corn|peas|beans? sprouts|eggplant|fennel|radish(es)?|beets?)\b/],
  ["Protein", /\b(chicken|beef|pork|lamb|turkey|sausage|bacon|guanciale|pancetta|fish|salmon|tuna|shrimp|cod|tofu|tempeh|eggs?)\b/],
  ["Dairy", /\b(milk|butter|cream|yogurt|yoghurt|cheese|cheddar|parmesan|pecorino|feta|mozzarella|ricotta|sour cream|creme fraiche)\b/],
  ["Household", /\b(paper towels?|towels?|soap|detergent|foil|wrap|bags?|sponges?|napkins?|tissues?)\b/],
];
export function guessCategory(name) { const n = norm(name); for (const [cat, re] of GUESS) if (re.test(n)) return cat; return "Pantry"; }

// Everything the three tabs need, in one call.
// Returns { categories:[{id,name,icon,sort}], week:[item], extras:[extra], pantry:[ingredient] }
//   item:  { ingredient_id, name, category, stock_status, in_cart, amounts:[{amount,unit}], recipes:[title] }
//   extra: { id, name, category, in_cart }
export async function shoppingData(start, end) {
  const meals = (await listWeek(start, end)).filter(m => m.status !== "made");
  if (isDemo) {
    const db = demo(), p = demoPantry(db), byId = Object.fromEntries(db.recipes.map(r => [r.id, r]));
    const week = collect(meals.flatMap(m => (byId[m.recipe.id]?.ingredients || []).map(g => ({ key: norm(g.name), name: p[norm(g.name)]?.name || g.name, amount: g.amount, unit: g.unit, recipe: m.recipe.title, ...pick(p[norm(g.name)]) }))));
    const pantry = Object.entries(p).map(([key, v]) => ({ ingredient_id: key, ...v })).sort((a, b) => a.name.localeCompare(b.name));
    return { categories: CATEGORIES.map(c => ({ ...c, id: c.name })), week, extras: (db.extras || []).map(x => ({ ...x })), pantry };
  }
  const categories = await ensureCategories();
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const catId = Object.fromEntries(categories.map(c => [c.name, c.id]));
  const ids = [...new Set(meals.map(m => m.recipe.id))];
  let lines = [];
  if (ids.length) {
    const { data, error } = await sb.from("recipe_ingredients").select("recipe_id,amount,unit,ingredients(id,name,stock_status,category_id,in_cart)").in("recipe_id", ids);
    if (error) throw error; lines = data;
  }
  const { data: ingAll, error: e2 } = await sb.from("ingredients").select("id,name,stock_status,category_id,in_cart").order("name"); if (e2) throw e2;
  // give uncategorized ingredients a best-guess category (once)
  const missing = ingAll.filter(i => !i.category_id);
  for (const i of missing) { i.category_id = catId[guessCategory(i.name)]; await sb.from("ingredients").update({ category_id: i.category_id }).eq("id", i.id); }
  const ingById = Object.fromEntries(ingAll.map(i => [i.id, i]));
  const titleById = Object.fromEntries(meals.map(m => [m.recipe.id, m.recipe.title]));
  const mealCount = id => meals.filter(m => m.recipe.id === id).length; // a recipe planned twice needs twice the ingredients
  const rows = lines.flatMap(l => { const i = ingById[l.ingredients?.id]; if (!i) return []; return Array.from({ length: mealCount(l.recipe_id) }, () => ({ key: i.id, name: i.name, amount: l.amount, unit: l.unit, recipe: titleById[l.recipe_id], stock_status: i.stock_status, in_cart: i.in_cart, category: catName[i.category_id] || "Pantry" })); });
  const { data: extras, error: e3 } = await sb.from("shopping_extras").select("id,name,category_id,in_cart").order("created_at"); if (e3) throw e3;
  return {
    categories,
    week: collect(rows),
    extras: extras.map(x => ({ id: x.id, name: x.name, in_cart: x.in_cart, category: catName[x.category_id] || "Household" })),
    pantry: ingAll.map(i => ({ ingredient_id: i.id, name: i.name, stock_status: i.stock_status, in_cart: i.in_cart, category: catName[i.category_id] || "Pantry" })),
  };
}
// merge lines for the same ingredient; sum amounts that share a unit
function collect(rows) {
  const by = new Map();
  for (const r of rows) {
    const it = by.get(r.key) || { ingredient_id: r.key, name: r.name, category: r.category, stock_status: r.stock_status, in_cart: !!r.in_cart, amounts: [], recipes: [] };
    const u = (r.unit || "").trim().toLowerCase(); const a = it.amounts.find(x => (x.unit || "").toLowerCase() === u);
    if (a) a.amount = a.amount == null || r.amount == null ? null : a.amount + r.amount; else it.amounts.push({ amount: r.amount ?? null, unit: r.unit || null });
    if (r.recipe && !it.recipes.includes(r.recipe)) it.recipes.push(r.recipe);
    by.set(r.key, it);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
const pick = v => (v ? { stock_status: v.stock_status, in_cart: v.in_cart, category: v.category } : { stock_status: "not_tracked", in_cart: false, category: "Pantry" });

async function ensureCategories() {
  let { data, error } = await sb.from("categories").select("id,name,icon,sort").order("sort");
  if (error) throw error;
  const have = new Set(data.map(c => norm(c.name)));
  const missing = CATEGORIES.filter(c => !have.has(norm(c.name)));
  if (missing.length) { const r = await sb.from("categories").insert(missing).select("id,name,icon,sort"); if (r.error) throw r.error; data = [...data, ...r.data].sort((a, b) => a.sort - b.sort); }
  return data;
}

export async function setStock(ingredientId, status) {
  if (isDemo) { const db = demo(); demoPantry(db)[ingredientId].stock_status = status; saveDemo(db); return; }
  const { error } = await sb.from("ingredients").update({ stock_status: status }).eq("id", ingredientId); if (error) throw error;
}
export async function setInCart(ingredientId, inCart) {
  if (isDemo) { const db = demo(); demoPantry(db)[ingredientId].in_cart = inCart; saveDemo(db); return; }
  const { error } = await sb.from("ingredients").update({ in_cart: inCart }).eq("id", ingredientId); if (error) throw error;
}
export async function setCategory(ingredientId, categoryName) {
  if (isDemo) { const db = demo(); demoPantry(db)[ingredientId].category = categoryName; saveDemo(db); return; }
  const cats = await ensureCategories(); const c = cats.find(x => x.name === categoryName);
  const { error } = await sb.from("ingredients").update({ category_id: c?.id || null }).eq("id", ingredientId); if (error) throw error;
}
export async function addExtra(name) {
  const category = guessCategory(name) === "Pantry" ? "Household" : guessCategory(name);
  if (isDemo) { const db = demo(); (db.extras ||= []).push({ id: uid(), name: name.trim(), category, in_cart: false }); saveDemo(db); return; }
  const cats = await ensureCategories(); const c = cats.find(x => x.name === category);
  const { error } = await sb.from("shopping_extras").insert({ name: name.trim(), category_id: c?.id || null }); if (error) throw error;
}
export async function setExtraInCart(id, inCart) {
  if (isDemo) { const db = demo(); const x = (db.extras || []).find(e => e.id === id); if (x) x.in_cart = inCart; saveDemo(db); return; }
  const { error } = await sb.from("shopping_extras").update({ in_cart: inCart }).eq("id", id); if (error) throw error;
}
export async function removeExtra(id) {
  if (isDemo) { const db = demo(); db.extras = (db.extras || []).filter(e => e.id !== id); saveDemo(db); return; }
  const { error } = await sb.from("shopping_extras").delete().eq("id", id); if (error) throw error;
}
// Done shopping: everything in the cart is now in stock; checked extras are cleared.
export async function finishShopping(ingredientIds) {
  if (isDemo) { const db = demo(), p = demoPantry(db); for (const k of ingredientIds) if (p[k]) { p[k].stock_status = "in_stock"; p[k].in_cart = false; } db.extras = (db.extras || []).filter(x => !x.in_cart); saveDemo(db); return; }
  if (ingredientIds.length) { const { error } = await sb.from("ingredients").update({ stock_status: "in_stock", in_cart: false }).in("id", ingredientIds); if (error) throw error; }
  const { error: e2 } = await sb.from("shopping_extras").delete().eq("in_cart", true); if (e2) throw e2;
}
// Demo: one pantry entry per unique ingredient name, built from the recipes.
function demoPantry(db) {
  db.pantry ||= {};
  for (const r of db.recipes) for (const g of r.ingredients) { const k = norm(g.name); db.pantry[k] ||= { name: g.name, stock_status: g.stock_status || "not_tracked", category: guessCategory(g.name), in_cart: false }; }
  return db.pantry;
}

function shiftDate(iso, days) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

// ---------------- helpers ----------------
const norm = s => String(s || "").trim().toLowerCase();
const byTitle = (a, b) => a.title.localeCompare(b.title);
const firstByNorm = list => { const m = new Map(); for (const x of list) if (!m.has(norm(x))) m.set(norm(x), x); return [...m.values()]; };
// Snap names to the spelling that already exists ("soup" → "Soup").
const canonical = (names, existing) => { const m = new Map(existing.map(e => [norm(e), e])); return firstByNorm(names.map(n => m.get(norm(n)) || n)); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const summary = r => ({ id: r.id, title: r.title, image_url: r.image_url, servings: r.servings, total_minutes: r.total_minutes, tags: r.tags });
function clean(r) {
  const num = v => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  const str = v => (v == null ? null : String(v).trim() || null);
  return {
    id: r.id || null,
    title: String(r.title || "").trim(),
    image_url: str(r.image_url),
    servings: Math.max(1, Math.round(num(r.servings) || 0)),
    total_minutes: num(r.total_minutes) ? Math.round(num(r.total_minutes)) : null,
    steps: (r.steps || []).map(s => String(s).trim()).filter(Boolean),
    notes: str(r.notes), source_url: str(r.source_url), source_notes: str(r.source_notes),
    tags: firstByNorm((r.tags || []).map(t => String(t).trim()).filter(Boolean)),
    ingredients: (r.ingredients || []).filter(g => String(g.name || "").trim())
      .map(g => ({ amount: num(g.amount), unit: str(g.unit), name: String(g.name).trim(), prep: str(g.prep), stock_status: g.stock_status || "not_tracked" })),
  };
}
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function safeDel(k) { try { localStorage.removeItem(k); } catch {} }

// ---------------- Demo backend ----------------
const DEMO_KEY = "kitchen-demo-v1";
let memoryDb = null;
function demo() {
  if (memoryDb) return memoryDb;
  const raw = safeGet(DEMO_KEY);
  memoryDb = raw ? JSON.parse(raw) : { recipes: SEED };
  if (!memoryDb.meal_plan) memoryDb.meal_plan = seedWeek();
  if (!raw || !JSON.parse(raw).meal_plan) saveDemo(memoryDb);
  return memoryDb;
}
function saveDemo(db) { memoryDb = db; safeSet(DEMO_KEY, JSON.stringify(db)); }
function seedWeek() {
  const now = new Date(), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const day = n => { const d = new Date(mon); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const at = new Date().toISOString();
  return [["lemon-chicken", 0, "made"], ["pasta-e-fagioli", 1, "planned"], ["miso-soup", 1, "planned"], ["shakshuka", 3, "planned"], ["focaccia", 5, "planned"], ["tomato-pie", 6, "planned"],
          ["cacio-e-pepe", -7, "made"], ["minestrone", -6, "made"], ["lemon-chicken", -4, "planned"]]
    .map(([recipe_id, n, status], i) => ({ id: "seed-" + i, recipe_id, date: day(n), status, created_at: at }));
}

const ing = (amount, unit, name, prep, stock_status = "not_tracked") => ({ amount, unit, name, prep, stock_status });
const SEED = [
  { id: "pasta-e-fagioli", title: "Pasta e Fagioli", servings: 4, total_minutes: 45, tags: ["Soup", "Pasta", "Weeknight"], source_url: "https://cooking.nytimes.com", notes: "Double the garlic. Parmesan rind in the pot if we have one.",
    ingredients: [ing(2, "tbsp", "Olive oil", null, "in_stock"), ing(1, null, "Onion", "diced", "low"), ing(3, "cloves", "Garlic", "minced", "in_stock"), ing(1, "can", "White beans", "drained", "out"), ing(1, "cup", "Ditalini", null, "in_stock"), ing(4, "cups", "Stock", null, "low")],
    steps: ["Warm the oil in a heavy pot. Add the onion; cook until soft, about 8 minutes.", "Add the garlic and cook 1 minute, until fragrant.", "Add the beans and stock. Simmer 15 minutes; mash a ladleful against the pot.", "Stir in the pasta and cook until tender. Season and serve."] },
  { id: "lemon-chicken", title: "Lemon Chicken", servings: 4, total_minutes: 40, tags: ["Weeknight"], notes: "Crisp the skin first.",
    ingredients: [ing(2, "lb", "Chicken thighs", null, "out"), ing(2, null, "Lemons", "sliced", "out"), ing(1, "tbsp", "Olive oil", null, "in_stock"), ing(4, "cloves", "Garlic", "smashed", "in_stock")],
    steps: ["Heat oven to 425°F.", "Brown the chicken skin-side down in an oven-safe pan.", "Add lemons and garlic, then roast 25 minutes."] },
  { id: "shakshuka", title: "Shakshuka", servings: 2, total_minutes: 30, tags: ["Weeknight", "Vegetarian"],
    ingredients: [ing(1, "can", "Crushed tomatoes"), ing(1, null, "Red pepper", "sliced"), ing(4, null, "Eggs", null, "low"), ing(1, "tsp", "Cumin", null, "in_stock"), ing(2, "oz", "Feta", "crumbled", "out")],
    steps: ["Soften the pepper in oil.", "Add tomatoes and cumin; simmer 10 minutes.", "Make wells and crack in the eggs. Cover until set.", "Top with feta."] },
  { id: "focaccia", title: "Focaccia", servings: 8, total_minutes: 180, tags: ["Baking"],
    ingredients: [ing(4, "cups", "Bread flour", null, "low"), ing(2, "tsp", "Yeast", null, "in_stock"), ing(2, "cups", "Water", "warm"), ing(0.25, "cup", "Olive oil", null, "in_stock"), ing(1, "tsp", "Flaky salt")],
    steps: ["Mix flour, yeast, water and salt into a shaggy dough.", "Rest 2 hours, folding twice.", "Press into an oiled pan, dimple, and bake at 450°F for 25 minutes."] },
  { id: "minestrone", title: "Minestrone", servings: 6, total_minutes: 50, tags: ["Soup", "Vegetarian"],
    ingredients: [ing(1, null, "Onion", "diced", "low"), ing(2, null, "Carrots", "diced"), ing(1, "can", "White beans", null, "out"), ing(6, "cups", "Stock", null, "low"), ing(1, "cup", "Ditalini", null, "in_stock")],
    steps: ["Sweat the vegetables in oil.", "Add stock and beans; simmer 20 minutes.", "Add pasta and cook until tender."] },
  { id: "miso-soup", title: "Miso Soup", servings: 2, total_minutes: 20, tags: ["Soup", "Weeknight"],
    ingredients: [ing(4, "cups", "Dashi"), ing(3, "tbsp", "White miso"), ing(7, "oz", "Silken tofu", "cubed"), ing(2, null, "Scallions", "sliced")],
    steps: ["Warm the dashi without boiling.", "Whisk in the miso off the heat.", "Add tofu and scallions."] },
  { id: "tomato-pie", title: "Tomato Pie", servings: 6, total_minutes: 60, tags: ["Baking"],
    ingredients: [ing(2, "lb", "Tomatoes", "sliced"), ing(1, null, "Pie crust", "blind-baked"), ing(1, "cup", "Cheddar", "grated")],
    steps: ["Salt and drain the tomatoes.", "Layer into the crust with cheese.", "Bake at 375°F for 35 minutes."] },
  { id: "cacio-e-pepe", title: "Cacio e Pepe", servings: 2, total_minutes: 20, tags: ["Pasta", "Weeknight"],
    ingredients: [ing(8, "oz", "Spaghetti"), ing(1, "cup", "Pecorino", "finely grated"), ing(2, "tsp", "Black pepper", "coarsely ground", "in_stock")],
    steps: ["Cook pasta in less water than usual; save a cup.", "Toast the pepper, add a splash of pasta water.", "Toss pasta with cheese and water off the heat until glossy."] },
];
