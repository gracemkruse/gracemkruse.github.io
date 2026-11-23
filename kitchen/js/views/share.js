import * as data from "../data.js";
import { icon } from "../icons.js";
import { esc, $, toast, amount, sourceName, isWebLink, notionNote, niceTitle, duration, sentence } from "../ui.js";

// Share a recipe (B-37). The recipe is drawn as one editorial page (Figma: 03 Visual Directions →
// "I · Book — Letter"), shown here, then sent as an image through the share sheet or printed.
// Page: 816 wide; at least Letter height (1056), longer when the method needs it. Photo 352 × 1056 down
// the left (landscape photos turned on their side to fill it; no photo = left side stays empty).
// One 368 column at x 400 holds the whole recipe, so zooming in on a phone shows ingredients and method.
const W = 816, MIN_H = 1056, M = 48, X = 400, CW = 368, PW = 352, IDX = 48, COL = 176, GUT = 16;
// Same families and weights as the recipe page in the app (Spectral Light, IBM Plex Mono, IBM Plex Sans), at 12 and smaller.
const FONT = { title: "300 40px Spectral", label: "400 8px 'IBM Plex Mono'", ing: "400 12px 'IBM Plex Mono'", body: "400 12px 'IBM Plex Sans'", num: "400 12px 'IBM Plex Mono'" };

export async function shareView(id, app) {
  const r = await data.getRecipe(id);
  if (!r) { app.innerHTML = `<p class="t-item">That recipe isn’t here anymore.</p><p><a class="btn-text" href="#/recipes">Back to recipes</a></p>`; return; }
  app.innerHTML = `
    <section class="share">
      <div class="topline">
        <a class="btn-text grey t-label" href="#/recipe/${encodeURIComponent(r.id)}">${icon("back", true)} Recipe</a>
        <span class="topline-actions">
          <button class="btn-text grey t-label" data-act="print" disabled>Print</button>
          <button class="btn-text t-label" data-act="send" disabled>Share</button>
        </span>
      </div>
      <p class="t-label grey" data-status>Making the page…</p>
      <img class="share-page" alt="${esc(r.title)}" hidden>
    </section>`;
  const img = $(".share-page", app), status = $("[data-status]", app), send = $('[data-act="send"]', app), printBtn = $('[data-act="print"]', app);

  let page;
  try { page = await makePage(r); }
  catch (e) { console.error(e); status.textContent = "Couldn’t make the page. Go back and try again."; return; }
  const url = URL.createObjectURL(page.blob);
  img.src = url; img.hidden = false; status.remove();
  if (page.noPhoto) toast(NO_PHOTO);
  send.disabled = printBtn.disabled = false;
  const file = pageFile(r, page);

  // Share sheet where there is one (phones, iPad, most desktops); otherwise save the image.
  send.onclick = async () => {
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: r.title }); }
      catch (e) { if (e.name !== "AbortError") toast("Couldn’t share. Try again."); }
    } else {
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
      toast("Saved the image.");
    }
  };
  // Print (or Save as PDF): one long page, the printer dialog can split it.
  printBtn.onclick = () => {
    const size = document.createElement("style");
    size.textContent = `@media print { @page { size: ${W}px ${page.height}px; margin: 0; } }`;
    document.head.appendChild(size);
    const before = document.title; document.title = r.title;
    addEventListener("afterprint", () => { size.remove(); document.title = before; }, { once: true });
    print();
  };
}

const NO_PHOTO = "Shared without the photo. That site doesn’t allow it.";
// The page as a file named after the recipe.
const pageFile = (r, page) => new File([page.blob], `${niceTitle(r.title).replace(/[\\/:*?"<>|]/g, "").trim() || "Recipe"}.png`, { type: "image/png" });

// Share straight from the recipe page: the page is drawn in the background as soon as the recipe opens,
// so a tap on Share can open the share sheet right away (phones only allow it straight after a tap).
// Where there's no share sheet for files (most computers), Share opens the preview page with Print.
export function directShare(r, button) {
  if (!navigator.canShare) { button.onclick = () => { location.hash = `#/recipe/${encodeURIComponent(r.id)}/share`; }; return; }
  let file = null, noPhoto = false;
  const ready = new Promise(res => setTimeout(res, 400)).then(() => makePage(r)).then(p => { noPhoto = p.noPhoto; file = pageFile(r, p); });
  ready.catch(e => console.error(e));
  const open = f => { if (noPhoto) toast(NO_PHOTO); return navigator.share({ files: [f], title: r.title })
    .catch(e => { if (e.name === "NotAllowedError") toast("Ready. Tap Share again."); else if (e.name !== "AbortError") toast("Couldn’t share. Try again."); }); };
  button.onclick = async () => {
    if (file) { if (navigator.canShare({ files: [file] })) open(file); else location.hash = `#/recipe/${encodeURIComponent(r.id)}/share`; return; }
    toast("Getting the page ready…");
    try { await ready; } catch { toast("Couldn’t make the page. Try again."); return; }
    if (navigator.canShare({ files: [file] })) open(file); else location.hash = `#/recipe/${encodeURIComponent(r.id)}/share`;
  };
}

// ---------- Drawing ----------
async function makePage(r) {
  await Promise.all(Object.values(FONT).map(f => document.fonts.load(f)));
  // many recipe sites don't let browsers draw their photos: then fetch it through the app's server
  let photo = r.image_url ? (await loadImage(r.image_url).catch(() => null)) || (await viaServer(r.image_url)) : null;
  let page = await draw(r, photo).catch(() => null);   // only fails when the photo wasn't allowed
  if (!page && photo) { photo = await viaServer(r.image_url); page = photo ? await draw(r, photo).catch(() => null) : null; }
  if (!page) { photo = null; page = await draw(r, null); }
  return { ...page, noPhoto: !!r.image_url && !photo };
}

async function draw(r, photo) {
  const height = Math.max(MIN_H, layout(document.createElement("canvas").getContext("2d"), r, false));
  const scale = 2;
  const c = document.createElement("canvas"); c.width = W * scale; c.height = height * scale;
  const ctx = c.getContext("2d"); ctx.scale(scale, scale);
  ctx.fillStyle = color("--white"); ctx.fillRect(0, 0, W, height);
  if (photo) drawPhoto(ctx, photo);
  layout(ctx, r, true);
  return { blob: toPng(c), height };
}

// PNG from the canvas. Synchronous on purpose: toBlob() can stall once a photo has been drawn.
// Throws if the photo wasn't allowed to be drawn (CORS), which makePage catches.
function toPng(c) {
  const bin = atob(c.toDataURL("image/png").split(",")[1]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

// Runs twice: once to measure, once to draw. Returns the page height.
// Spacing: 48 margins, 16 title → meta, 40 between sections, 12 label → content, 8 between steps.
function layout(ctx, r, paint) {
  const ink = color("--ink"), green = color("--chartreuse");
  const ings = r.ingredients.filter(g => g.name);
  let y = M;

  const title = wrap(ctx, niceTitle(r.title), FONT.title, CW);
  if (paint) title.forEach((l, i) => text(ctx, l, X, base(y + i * 44, 44, 40), FONT.title, ink));
  y += title.length * 44;

  const meta = metaLine(r);
  if (meta) { y += 16; if (paint) label(ctx, meta, X, base(y, 12, 8), green); y += 12; }

  if (ings.length) {
    y = section(ctx, "Ingredients", y, paint, green);
    const half = Math.ceil(ings.length / 2);
    const ends = [ings.slice(0, half), ings.slice(half)].map((list, col) => {
      const x = X + col * (COL + GUT); let cy = y;
      for (const g of list) {
        const lines = wrap(ctx, sentence(g.name) + (g.prep ? `, ${g.prep}` : ""), FONT.ing, COL - IDX);
        if (paint) {
          label(ctx, amount(g.amount, g.unit), x, base(cy, 16, 12), green);
          lines.forEach((l, i) => text(ctx, l, x + IDX, base(cy + i * 16, 16, 12), FONT.ing, ink));
        }
        cy += lines.length * 16;
      }
      return cy;
    });
    y = Math.max(...ends);
  }

  if (r.steps.length) {
    y = section(ctx, "Method", y, paint, green);
    r.steps.forEach((s, i) => {
      const lines = wrap(ctx, s, FONT.body, CW - IDX);
      if (paint) {
        text(ctx, `${i + 1}.`, X, base(y, 16, 12), FONT.num, green);
        lines.forEach((l, j) => text(ctx, l, X + IDX, base(y + j * 16, 16, 12), FONT.body, ink));
      }
      y += lines.length * 16 + (i < r.steps.length - 1 ? 8 : 0);
    });
  }
  return y + M;
}

function section(ctx, name, y, paint, green) {
  y += 40; if (paint) label(ctx, name, X, base(y, 12, 8), green);
  return y + 12 + 12;
}

// Source · Serves N · About N hours: each only when known.
function metaLine(r) {
  const link = isWebLink(r.source_url) ? r.source_url : null;
  const source = link ? sourceName(link) : [r.source_url ? notionNote(r.source_url) : "", r.source_notes].filter(Boolean).join(", ");
  return [source, r.servings ? `Serves ${r.servings}` : "", r.total_minutes ? `About ${duration(r.total_minutes)}` : ""].filter(Boolean).join(" · ");
}

// Photo fills 352 × 1056, cropped from the centre. Landscape photos are turned a quarter clockwise first.
function drawPhoto(ctx, img) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PW, MIN_H); ctx.clip();
  if (iw > ih) { ctx.translate(PW, 0); ctx.rotate(Math.PI / 2); cover(ctx, img, MIN_H, PW); }
  else cover(ctx, img, PW, MIN_H);
  ctx.restore();
}
function cover(ctx, img, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
async function viaServer(src) {
  if (!/^https?:/i.test(src) || data.ownPhoto(src)) return null;
  try { const blob = await data.photoFromLink(src); return await loadImage(URL.createObjectURL(blob)); }
  catch (e) { console.warn("Photo couldn’t be fetched", e); return null; }
}
async function loadImage(src) {
  const img = new Image(); img.crossOrigin = "anonymous";
  // a separate URL so the browser doesn't reuse a copy it fetched without CORS for the recipe page
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
    img.src = src.startsWith("http") ? src + (src.includes("?") ? "&" : "?") + "share" : src; });
  return img;
}

// ---------- Text helpers ----------
const color = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
// Baseline for text of size fs centred in a line box of height lh starting at top (matches CSS closely).
const base = (top, lh, fs) => top + lh / 2 + fs * 0.35;
function text(ctx, s, x, y, font, fill) { ctx.font = font; ctx.fillStyle = fill; ctx.fillText(s, x, y); }
// Labels: Plex Mono 8, upper case, 8% letter spacing (drawn a letter at a time so every browser spaces them).
function label(ctx, s, x, y, fill) {
  ctx.font = FONT.label; ctx.fillStyle = fill;
  for (const ch of s.toUpperCase()) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + 0.64; }
}
function wrap(ctx, s, font, width) {
  ctx.font = font; const out = [];
  for (const para of String(s).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}
