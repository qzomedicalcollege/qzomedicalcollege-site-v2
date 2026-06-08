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

## Build fix

This version removes `@astrojs/sitemap` from `astro.config.mjs` and `package.json` because the previous GitHub Actions build failed after route generation inside the sitemap integration.

## Admin Plus update

В этой версии улучшена админ-панель:

- предпросмотр записи перед публикацией;
- фильтр по разделу, статусу, категории и поиску;
- статистика по записям и файлам;
- быстрое переключение статуса опубликовано/черновик;
- дублирование записи;
- копирование публичной ссылки на материал;
- закрепление записи через высокий `sort_order`;
- метка «Важно» через высокий `sort_order` или категорию «Важно»;
- улучшенный список файлов: открыть / убрать из записи;
- при сохранении удалённые из записи файлы удаляются из Supabase Storage;
- при удалении записи файлы также удаляются из Supabase Storage.

Дополнительный SQL не нужен: используется текущая таблица `site_posts` и поле `sort_order`.


## Site Pro update

Если проект уже был установлен до версии Site Pro, выполните в Supabase SQL Editor файл `supabase/upgrade-sitepro.sql`. Он добавляет колонку `metadata` для карточек преподавателей, руководства, специальностей, галереи и объявлений.
