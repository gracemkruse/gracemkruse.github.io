// Supabase Edge Function: recipe-from-link
// Reads a recipe web page and returns the recipe it publishes for search engines (schema.org "Recipe"
// JSON-LD), which almost every recipe site includes. No AI, no cost.
// Only signed-in users can call it (Supabase checks the login token before this runs).
//
// Request:  POST { url: "https://…" }
// Response: { title, image_url, servings, total_minutes, ingredients: ["2 cups flour", …], steps: [...],
//             notes, source_url }   or   { error: "…" }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { url } = await req.json();
    const u = new URL(String(url || ""));
    if (!/^https?:$/.test(u.protocol)) return reply({ error: "That doesn’t look like a web link." }, 400);
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$)/.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname))
      return reply({ error: "That link can’t be read." }, 400);

    const res = await fetch(u.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return reply({ error: `The site said no (${res.status}). Some sites block apps — add it by hand.` }, 200);
    const html = (await res.text()).slice(0, 3_000_000);

    return reply(extract(html, u.href));
  } catch (e) {
    return reply({ error: "Couldn’t read that page. " + (e && e.message ? e.message : "") }, 200);
  }
});

// ---- page HTML → recipe (exported so it can be tested without a server) ----
export function extract(html, href) {
  const og = (p) => html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']+)`, "i"))?.[1]
                 || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${p}["']`, "i"))?.[1];
  const recipe = findRecipe(html) || microdata(html);
  if (!recipe) {
    // last resort: list items that start with an amount look like ingredients
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
    const items = [...body.matchAll(/<(li|p)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => decode(m[2]))
      .filter((t) => t.length < 120 && /^(\d|[½⅓⅔¼¾⅛]|one |two |a |an )/i.test(t));
    const ings = items.length >= 3 ? [...new Set(items)].slice(0, 40) : [];
    return { error: ings.length ? "This site doesn’t label its recipe, so ingredients were guessed from the page — check them, and add the method." : "No recipe found on that page — the title and photo are filled in so you can add the rest.",
      title: decode(og("title") || html.match(/<title>([^<]+)/i)?.[1] || "").replace(/\s+[-–|]\s+[^-–|]+$/, ""), image_url: og("image") || null, source_url: href, ingredients: ings, steps: [] };
  }
  return {
    title: decode(text(recipe.name)),
    image_url: image(recipe.image) || og("image") || null,
    servings: servings(recipe.recipeYield),
    total_minutes: minutes(recipe.totalTime) || (minutes(recipe.prepTime) + minutes(recipe.cookTime)) || null,
    ingredients: list(recipe.recipeIngredient || recipe.ingredients).map(decode).filter(Boolean),
    steps: steps(recipe.recipeInstructions).map(decode).filter(Boolean),
    notes: decode(text(recipe.description)) || null,
    source_url: href,
  };
}

// ---- older sites mark recipes up with microdata (itemprop="…") instead of JSON-LD ----
function microdata(html) {
  const start = html.search(/itemtype=["']https?:\/\/schema\.org\/Recipe["']/i);
  if (start < 0) return null;
  const h = html.slice(start, start + 400000);
  const props = (name) => [...h.matchAll(new RegExp(`<(\\w+)[^>]*itemprop=["']${name}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "gi"))].map((m) => m[2]);
  const attr = (name, a) => h.match(new RegExp(`itemprop=["']${name}["'][^>]*${a}=["']([^"']+)`, "i"))?.[1] || h.match(new RegExp(`${a}=["']([^"']+)["'][^>]*itemprop=["']${name}["']`, "i"))?.[1];
  const parts = (inner) => inner.split(/<\/(?:p|li|div)>|<br\s*\/?>/i).map((x) => decode(x)).filter(Boolean);
  return {
    name: decode(props("name")[0] || ""),
    image: attr("image", "src") || attr("image", "content") || null,
    recipeYield: decode(props("recipeYield")[0] || attr("recipeYield", "content") || ""),
    totalTime: attr("totalTime", "content") || attr("totalTime", "datetime"),
    recipeIngredient: [...props("recipeIngredient"), ...props("ingredients")].map(decode),
    recipeInstructions: (props("recipeInstructions").length ? props("recipeInstructions")
      : [h.match(/class=["'][^"']*(?:e-instructions|recipe-directions)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ""]).flatMap(parts),
    description: decode(props("description")[0] || ""),
  };
}

// ---- find the Recipe object in any JSON-LD block (it may sit inside @graph or an array) ----
function findRecipe(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b.trim()); } catch { try { data = JSON.parse(b.trim().replace(/[\u0000-\u001f]+/g, " ")); } catch { continue; } }
    const hit = walk(data);
    if (hit) return hit;
  }
  return null;
}
function walk(x) {
  if (!x || typeof x !== "object") return null;
  if (Array.isArray(x)) { for (const y of x) { const h = walk(y); if (h) return h; } return null; }
  const t = x["@type"]; const types = Array.isArray(t) ? t : [t];
  if (types.some((v) => String(v).toLowerCase() === "recipe")) return x;
  for (const k of ["@graph", "mainEntity", "itemListElement"]) { const h = walk(x[k]); if (h) return h; }
  return null;
}

// ---- small normalizers ----
const text = (v) => (v == null ? "" : Array.isArray(v) ? text(v[0]) : typeof v === "object" ? text(v.text || v.name || "") : String(v)).trim();
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(text).filter(Boolean);
function image(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return image(v[v.length > 1 ? 1 : 0]) || image(v[0]);   // second is often the larger crop
  return v.url || v.contentUrl || null;
}
function servings(v) {
  const s = Array.isArray(v) ? v.map(String).join(" ") : String(v ?? "");
  const n = s.match(/\d+/); return n ? Math.max(1, Math.min(100, parseInt(n[0]))) : null;
}
function minutes(v) {
  const m = String(v || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  return m ? (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
}
function steps(v) {
  const out = [];
  const add = (x, section = "") => {
    if (!x) return;
    if (typeof x === "string") { x.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return; }
    if (Array.isArray(x)) { x.forEach((y) => add(y, section)); return; }
    const type = String(x["@type"] || "");
    if (/HowToSection/i.test(type)) {
      const name = text(x.name);
      const before = out.length; add(x.itemListElement, name);
      if (name && out.length > before) out[before] = `${name}: ${out[before]}`;   // keep the section name on its first step
      return;
    }
    const t = text(x.text || x.name); if (t) out.push(t);
  };
  add(v);
  return out.map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
}
function decode(s) {
  return String(s || "").replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
