-- Замени email на email пользователя, которого создал в Authentication → Users.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;

select au.user_id, u.email
from public.admin_users au
join auth.users u on u.id = au.user_id;
