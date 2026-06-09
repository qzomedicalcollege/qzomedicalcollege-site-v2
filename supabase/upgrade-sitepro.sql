-- qzomedicalcollege-site-v2 Site Pro migration
-- Выполнить в Supabase → SQL Editor после загрузки Site Pro.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- Совместимость со старыми версиями таблицы.
alter table public.site_posts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- У старых таблиц id мог быть без default. Это ломает публикацию из админки.
do $$
declare
  id_type text;
begin
  select data_type
  into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'site_posts'
    and column_name = 'id';

  if id_type = 'uuid' then
    execute 'alter table public.site_posts alter column id set default gen_random_uuid()';
  elsif id_type in ('text', 'character varying') then
    execute 'alter table public.site_posts alter column id set default gen_random_uuid()::text';
  end if;
end $$;

-- Актуальный список разделов.
alter table public.site_posts
  drop constraint if exists site_posts_section_check;

alter table public.site_posts
  add constraint site_posts_section_check
  check (section in (
    'news', 'announcements', 'about', 'admission', 'students', 'specialties',
    'documents', 'schedule', 'gallery', 'teachers', 'management', 'faq'
  ));

-- Журнал действий админки.
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null default 'site_posts',
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_posts to authenticated;
grant select, insert on public.admin_activity_logs to authenticated;

alter table public.site_posts enable row level security;
alter table public.admin_activity_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Политики site_posts.
drop policy if exists "Public can read published posts" on public.site_posts;
drop policy if exists "Admins can insert posts" on public.site_posts;
drop policy if exists "Admins can update posts" on public.site_posts;
drop policy if exists "Admins can delete posts" on public.site_posts;

create policy "Public can read published posts"
on public.site_posts
for select
to anon, authenticated
using (status = 'published' or public.is_admin());

create policy "Admins can insert posts"
on public.site_posts
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update posts"
on public.site_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete posts"
on public.site_posts
for delete
to authenticated
using (public.is_admin());

-- Политики журнала.
drop policy if exists "Admins can read activity logs" on public.admin_activity_logs;
drop policy if exists "Admins can insert activity logs" on public.admin_activity_logs;

create policy "Admins can read activity logs"
on public.admin_activity_logs
for select
to authenticated
using (public.is_admin());

create policy "Admins can insert activity logs"
on public.admin_activity_logs
for insert
to authenticated
with check (public.is_admin() and user_id = auth.uid());

notify pgrst, 'reload schema';

select 'Site Pro migration completed' as status;
