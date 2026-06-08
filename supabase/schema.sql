-- qzomedicalcollege-site-v2: база данных сайта
-- Выполнить в Supabase → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_posts (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('news', 'about', 'admission', 'students', 'specialties', 'documents', 'schedule')),
  title text not null,
  content text,
  category text,
  status text not null default 'published' check (status in ('draft', 'published')),
  image_url text,
  files jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_posts_section_status_idx on public.site_posts(section, status, published_at desc);
create index if not exists site_posts_category_idx on public.site_posts(category);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_site_posts_updated_at on public.site_posts;
create trigger trg_site_posts_updated_at
before update on public.site_posts
for each row execute function public.set_updated_at();

-- Проверка, является ли текущий пользователь админом.
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

-- Базовые права для API-ролей.
grant usage on schema public to anon, authenticated;
grant select on public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_posts to authenticated;
grant select on public.admin_users to authenticated;

alter table public.site_posts enable row level security;
alter table public.admin_users enable row level security;

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

-- Политика admin_users без рекурсии.
drop policy if exists "Users can read own admin row" on public.admin_users;
create policy "Users can read own admin row"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());
