-- ORANGE FIT · 011 · Storage: buckets y políticas por carpeta {user_id}/…
-- progress-photos y meal-photos: privados (URL firmada), solo imágenes, máx. 10 MB.
-- recipe-images: público para leer; escribe el staff o el dueño en su carpeta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('progress-photos', 'progress-photos', false, 10485760, array['image/*']),
  ('meal-photos', 'meal-photos', false, 10485760, array['image/*']),
  ('recipe-images', 'recipe-images', true, 10485760, array['image/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- progress-photos / meal-photos: solo el dueño, dentro de su carpeta
-- ---------------------------------------------------------------------------
create policy private_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id in ('progress-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy private_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('progress-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy private_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id in ('progress-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('progress-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy private_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('progress-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- recipe-images
-- ---------------------------------------------------------------------------
create policy recipe_images_select_all on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'recipe-images');

create policy recipe_images_insert_owner_or_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_role('editor'))
    )
  );

create policy recipe_images_update_owner_or_staff on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_role('editor'))
    )
  )
  with check (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_role('editor'))
    )
  );

create policy recipe_images_delete_owner_or_staff on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_role('editor'))
    )
  );
