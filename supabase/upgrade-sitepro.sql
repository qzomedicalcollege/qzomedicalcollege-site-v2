-- qzomedicalcollege-site-v2 Site Pro migration
-- Выполнить один раз в Supabase → SQL Editor после Mega Plus.

alter table public.site_posts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

grant select on public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_posts to authenticated;

-- Быстрая проверка.
select 'Site Pro migration completed' as status;
