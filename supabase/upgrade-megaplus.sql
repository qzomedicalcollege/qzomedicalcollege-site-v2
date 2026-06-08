-- qzomedicalcollege-site-v2 Mega Plus migration
-- Выполнить один раз в Supabase → SQL Editor, если база уже была создана ранней версией проекта.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

alter table public.site_posts
  drop constraint if exists site_posts_section_check;

alter table public.site_posts
  add constraint site_posts_section_check
  check (section in (
    'news', 'announcements', 'about', 'admission', 'students', 'specialties',
    'documents', 'schedule', 'gallery', 'teachers', 'management', 'faq'
  ));

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null default 'site_posts',
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.admin_activity_logs to authenticated;
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

-- Быстрая проверка.
select 'Mega Plus migration completed' as status;
