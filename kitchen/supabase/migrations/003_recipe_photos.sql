-- Slice 4 (photo upload): a storage bucket for recipe photos.
-- Photos are public by link (long random file names, nothing to list), but only the
-- signed-in household account can add, replace or delete them, and only in its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "recipe photos: add own" on storage.objects;
drop policy if exists "recipe photos: change own" on storage.objects;
drop policy if exists "recipe photos: delete own" on storage.objects;
create policy "recipe photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recipe photos: change own" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recipe photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
