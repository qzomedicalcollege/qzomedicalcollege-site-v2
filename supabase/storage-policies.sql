-- qzomedicalcollege-site-v2: политики Storage
-- Перед запуском создай bucket с названием: qzomedicalcollege-site-v2
-- Storage → New bucket → Public bucket: ON.

-- Публичное чтение файлов из bucket.
drop policy if exists "Public read qzomedicalcollege-site-v2 files" on storage.objects;
create policy "Public read qzomedicalcollege-site-v2 files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'qzomedicalcollege-site-v2');

-- Загружать файлы может только админ.
drop policy if exists "Admins upload qzomedicalcollege-site-v2 files" on storage.objects;
create policy "Admins upload qzomedicalcollege-site-v2 files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'qzomedicalcollege-site-v2'
  and public.is_admin()
);

-- Обновлять файлы может только админ.
drop policy if exists "Admins update qzomedicalcollege-site-v2 files" on storage.objects;
create policy "Admins update qzomedicalcollege-site-v2 files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'qzomedicalcollege-site-v2'
  and public.is_admin()
)
with check (
  bucket_id = 'qzomedicalcollege-site-v2'
  and public.is_admin()
);

-- Удалять файлы может только админ.
drop policy if exists "Admins delete qzomedicalcollege-site-v2 files" on storage.objects;
create policy "Admins delete qzomedicalcollege-site-v2 files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'qzomedicalcollege-site-v2'
  and public.is_admin()
);
