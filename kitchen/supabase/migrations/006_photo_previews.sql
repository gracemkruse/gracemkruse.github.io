-- 006 · Gallery photo previews
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- A small copy of each recipe photo (640px, ~40 KB) for the gallery, so browsing recipes downloads
-- about a tenth as much. The full photo stays as it is and is used on the recipe page, sharing and print.
alter table recipes add column if not exists image_thumb text;
