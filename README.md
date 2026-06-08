# qzomedicalcollege-site-v2

Astro V2-сайт для Қызылорда жоғары медициналық колледжі.

## Стек

- Astro
- Static build for GitHub Pages
- Supabase Auth
- Supabase Database
- Supabase Storage

## Supabase config

Уже вставлено в `public/js/config.js`:

```js
SUPABASE_URL = 'https://wixnoscozvzxtiwuqark.supabase.co'
SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jcHae0bpHG1VtR-0WZ14ew_jbRCb64N'
SUPABASE_BUCKET = 'qzomedicalcollege-site-v2'
```

Не вставляй в frontend:

- service_role key
- database password
- JWT secret
- connection string

## Настройка Supabase

### 1. Создать таблицы

Открой Supabase → SQL Editor и выполни:

```text
supabase/schema.sql
```

### 2. Создать bucket

Supabase → Storage → New bucket:

```text
Name: qzomedicalcollege-site-v2
Public bucket: ON
```

### 3. Добавить Storage policies

SQL Editor → выполнить:

```text
supabase/storage-policies.sql
```

### 4. Создать пользователя-админа

Supabase → Authentication → Users → Add user.

Если не хочешь подтверждать email, отключи:

```text
Authentication → Providers → Email → Confirm email: OFF
```

Потом в SQL Editor выполни:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть:

```text
http://localhost:4321/qzomedicalcollege-site-v2/
```

Админка:

```text
http://localhost:4321/qzomedicalcollege-site-v2/admin.html
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

В репозитории `qzomedicalcollege-site-v2`:

1. Загрузи все файлы из этой папки в корень репозитория.
2. Открой `Settings → Pages`.
3. Source: `GitHub Actions`.
4. Сделай push в `main`.
5. Workflow `.github/workflows/deploy.yml` сам соберёт Astro и опубликует `dist`.

Адрес будет примерно:

```text
https://<username>.github.io/qzomedicalcollege-site-v2/
```

Если подключишь свой домен, поменяй в `astro.config.mjs`:

```js
base: '/'
```

и `site` на свой домен.

## Разделы сайта

- Главная
- О колледже
- Абитуриентам
- Студентам
- Специальности
- Документы
- Расписание
- Новости
- Контакты
- Админка

## Что умеет админка

- вход через Supabase Auth;
- проверка пользователя через `admin_users`;
- добавление записей;
- редактирование записей;
- удаление записей;
- удаление файлов из Storage вместе с записью;
- загрузка PDF, Word, Excel, PowerPoint, TXT и изображений;
- черновики и публикация;
- выбор раздела сайта;
- фильтр и поиск по записям.
