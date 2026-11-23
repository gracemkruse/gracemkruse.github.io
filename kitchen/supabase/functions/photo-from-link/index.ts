// Supabase Edge Function: photo-from-link
// Fetches a recipe photo from another website and hands the bytes back to the app.
// Why: many recipe sites don't let browsers draw their photos into a canvas (no CORS), so the app
// can't put them in a shared page image or copy them into your own photo storage by itself.
// Only signed-in users can call it: Supabase checks the token's signature before this runs, and the
// function also requires the "authenticated" role (the app's public key alone isn't enough).
// It doesn't store anything; the app uploads the photo to your storage as you.
//
// Request:  POST { url: "https://…/photo.jpg" }
// Response: the image bytes (image/*), or { error: "…" } with status 400/502

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX = 10 * 1024 * 1024;
const fail = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Role inside the (already signature-checked) login token.
function role(req: Request): string {
  try {
    const part = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1] || "";
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="))).role || "";
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (role(req) !== "authenticated") return fail("Sign in first.", 401);
  try {
    const { url } = await req.json();
    const u = new URL(String(url || ""));
    if (!/^https?:$/.test(u.protocol)) return fail("That doesn’t look like a web link.", 400);
    // never fetch addresses inside a private network
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$)/.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname))
      return fail("That link can’t be read.", 400);

    const res = await fetch(u.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept": "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
      },
    });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok) return fail(`The site said no (${res.status}).`, 502);
    if (!type.startsWith("image/")) return fail("That link isn’t a photo.", 400);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX) return fail("That photo is too big.", 400);
    return new Response(bytes, { headers: { ...CORS, "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return fail("Couldn’t fetch that photo. " + (e && (e as Error).message ? (e as Error).message : ""), 502);
  }
});
