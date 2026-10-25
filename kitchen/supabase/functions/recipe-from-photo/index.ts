// Supabase Edge Function: recipe-from-photo  (Quick Add)
// Sends 1–3 photos of a recipe (cookbook page, card, screenshot) to Claude and returns the recipe in the
// same shape as recipe-from-link, so the app fills the New recipe form the same way.
// Needs the secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets). Only signed-in users can call it.
//
// Request:  POST { images: [{ data: "<base64>", media_type: "image/jpeg" }, …] }
// Response: { title, servings, total_minutes, ingredients: ["2 cups flour", …], steps: [...], notes, source_notes }
//           or { error: "…" }
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// The answer Claude must give, exactly (structured output).
const RECIPE = {
  type: "object",
  additionalProperties: false,
  required: ["is_recipe", "title", "servings", "total_minutes", "ingredients", "steps", "notes", "source_notes"],
  properties: {
    is_recipe: { type: "boolean", description: "false if the photos do not show a recipe" },
    title: { type: "string" },
    servings: { type: "integer", description: "0 if not stated" },
    total_minutes: { type: "integer", description: "0 if not stated" },
    ingredients: { type: "array", items: { type: "string" }, description: "One line each, as written: amount, unit, ingredient, then prep after a comma. e.g. \"1 ½ cups all-purpose flour, sifted\"" },
    steps: { type: "array", items: { type: "string" }, description: "One method step each, in order, as written. Keep a section name at the start of its first step (\"For the sauce: …\")." },
    notes: { type: "string", description: "Headnote or tips worth keeping, short; empty if none" },
    source_notes: { type: "string", description: "Book or author and page number if visible, e.g. \"Salt Fat Acid Heat, p. 214\"; empty if not visible" },
  },
};

const PROMPT = `These photos show one recipe (a cookbook page, a recipe card, a handwritten note, or a screenshot). If there are several photos, they are pages of the same recipe in order.

Transcribe the recipe faithfully into the requested structure. Copy amounts, units and wording as written — do not convert, scale, or invent anything. If something is unreadable, leave it out rather than guessing. Ignore page furniture such as page headers, other recipes on the same page, and ads.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "Quick Add isn’t set up yet: add the ANTHROPIC_API_KEY secret in Supabase." });
    const { images } = await req.json();
    const pics = (Array.isArray(images) ? images : []).slice(0, 3)
      .filter((i) => i && typeof i.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type));
    if (!pics.length) return reply({ error: "No photo came through — try again." }, 400);

    const client = new Anthropic({ apiKey: key });
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",                              // if a safety check declines, Anthropic retries on its recommended model
      output_config: { effort: "medium", format: { type: "json_schema", schema: RECIPE } },
      messages: [{
        role: "user",
        content: [
          ...pics.map((p) => ({ type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } })),
          { type: "text", text: PROMPT },
        ],
      }],
    });

    if (response.stop_reason === "refusal") return reply({ error: "Claude couldn’t read this one — add it by hand." });
    if (response.stop_reason === "max_tokens") return reply({ error: "That recipe was too long to read in one go — try one page at a time." });
    const text = response.content.find((b) => b.type === "text");
    if (!text) return reply({ error: "No recipe came back — try a clearer photo." });
    const r = JSON.parse(text.text);
    if (!r.is_recipe) return reply({ error: "That doesn’t look like a recipe — try another photo." });
    return reply({
      title: r.title,
      servings: r.servings || null,
      total_minutes: r.total_minutes || null,
      ingredients: r.ingredients,
      steps: r.steps,
      notes: r.notes || null,
      source_notes: r.source_notes || null,
    });
  } catch (e) {
    const status = e && typeof e.status === "number" ? e.status : 0;
    if (status === 401) return reply({ error: "The Anthropic API key was rejected — check the ANTHROPIC_API_KEY secret." });
    if (status === 402 || /credit|billing/i.test(String(e && e.message))) return reply({ error: "Out of Anthropic credits — add funds at platform.claude.com." });
    if (status === 429 || status === 529) return reply({ error: "Claude is busy right now — try again in a minute." });
    return reply({ error: "Couldn’t read the photo. " + (e && e.message ? e.message : "") });
  }
});
