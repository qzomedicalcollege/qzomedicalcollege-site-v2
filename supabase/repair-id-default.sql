create extension if not exists pgcrypto;

alter table public.site_posts
alter column id set default gen_random_uuid();

alter table public.site_posts
add column if not exists metadata jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
