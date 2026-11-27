// Kitchen service worker: always ask the server for the newest app files (so updates show right after
// a merge, no hard refresh), and fall back to the last copy when offline. Data (Supabase), fonts and
// libraries from other sites are left alone.
const CACHE = "kitchen-app";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Recipe photos never change (every upload gets a new file name), so keep each one after the first
// download instead of fetching it again on every gallery visit. Saves Supabase bandwidth (egress).
const PHOTOS = "kitchen-photos";
const isPhoto = url => url.pathname.includes("/storage/v1/object/public/recipe-photos/");

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && isPhoto(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(PHOTOS);
      const hit = await cache.match(url.href);
      if (hit) return hit;
      // ask with CORS (Supabase allows it) so the stored copy is a normal response, not an opaque one
      const res = await fetch(new Request(url.href, { mode: "cors", credentials: "omit" }));
      if (res.ok) cache.put(url.href, res.clone());
      return res;
    })().catch(() => fetch(e.request)));
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // "no-cache" = check with the server every time (cheap: unchanged files come back as 304)
    const req = e.request.mode === "navigate" ? new Request(url.href, { cache: "no-cache", credentials: "same-origin" }) : new Request(e.request, { cache: "no-cache" });
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: e.request.mode === "navigate" })) || Response.error();
    }
  })());
});
