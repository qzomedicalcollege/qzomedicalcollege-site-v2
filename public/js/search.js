import { supabase } from './supabaseClient.js';

const siteBase = (() => {
  const raw = window.SITE_BASE || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

const sectionLabels = {
  news: 'Новости',
  announcements: 'Объявления',
  about: 'О колледже',
  admission: 'Абитуриентам',
  students: 'Студентам',
  specialties: 'Специальности',
  documents: 'Документы',
  schedule: 'Расписание',
  gallery: 'Галерея',
  teachers: 'Преподаватели',
  management: 'Руководство',
  faq: 'FAQ'
};

const staticPages = [
  { title: 'О колледже', section: 'Страница', href: 'about.html', text: 'История, миссия, аккредитация и официальная информация о колледже.' },
  { title: 'Абитуриентам', section: 'Страница', href: 'admission.html', text: 'Поступление, документы, специальности и приёмная комиссия.' },
  { title: 'Специальности', section: 'Страница', href: 'specialties.html', text: 'Образовательные программы и направления подготовки.' },
  { title: 'Студентам', section: 'Страница', href: 'students.html', text: 'Учебные материалы, практика, объявления и полезные документы.' },
  { title: 'Документы', section: 'Страница', href: 'documents.html', text: 'Лицензии, аккредитация, правила, приказы и файлы для скачивания.' },
  { title: 'Расписание', section: 'Страница', href: 'schedule.html', text: 'Расписание занятий, экзаменов, практики и учебные графики.' },
  { title: 'Объявления', section: 'Страница', href: 'announcements.html', text: 'Важные уведомления, собрания, практика и экзамены.' },
  { title: 'Галерея', section: 'Страница', href: 'gallery.html', text: 'Фотоальбомы мероприятий и студенческой жизни.' },
  { title: 'Преподаватели', section: 'Страница', href: 'teachers.html', text: 'Педагогический состав и цикловые комиссии.' },
  { title: 'Руководство', section: 'Страница', href: 'management.html', text: 'Администрация колледжа и заведующие отделениями.' },
  { title: 'FAQ', section: 'Страница', href: 'faq.html', text: 'Частые вопросы о поступлении, обучении и документах.' },
  { title: 'Контакты', section: 'Страница', href: 'contacts.html', text: 'Адрес, телефон, email и связь с приёмной комиссией.' }
];

const input = document.getElementById('siteSearchInput');
const select = document.getElementById('siteSearchSection');
const button = document.getElementById('siteSearchButton');
const results = document.getElementById('siteSearchResults');
const summary = document.getElementById('siteSearchSummary');

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

function excerpt(value = '', max = 230) {
  const text = String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function highlight(text = '', query = '') {
  const clean = escapeHTML(text);
  const q = query.trim();
  if (!q) return clean;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean.replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>');
}

function renderStaticPages(query) {
  const q = query.trim().toLowerCase();
  if (!q) return staticPages.slice(0, 4);
  return staticPages.filter((page) => `${page.title} ${page.text}`.toLowerCase().includes(q));
}

function render(items, pages, query) {
  const total = items.length + pages.length;
  summary.textContent = query ? `Найдено: ${total}` : `Последние материалы: ${total}`;

  if (!total) {
    results.innerHTML = '<div class="empty-state">По этому запросу ничего не найдено. Попробуйте другое слово.</div>';
    return;
  }

  const pageHtml = pages.map((page) => `
    <article class="search-result-card static-result">
      <div class="post-meta"><span>${escapeHTML(page.section)}</span></div>
      <h3><a href="${siteBase}${escapeHTML(page.href)}">${highlight(page.title, query)}</a></h3>
      <p>${highlight(page.text, query)}</p>
      <a class="read-more" href="${siteBase}${escapeHTML(page.href)}">Открыть страницу →</a>
    </article>
  `).join('');

  const postHtml = items.map((post) => {
    const section = sectionLabels[post.section] || post.section;
    const date = formatDate(post.published_at || post.created_at);
    const files = Array.isArray(post.files) ? post.files.length : 0;
    return `
      <article class="search-result-card">
        <div class="post-meta"><span>${escapeHTML(section)}</span>${date ? `<span>${date}</span>` : ''}${post.category ? `<span>${escapeHTML(post.category)}</span>` : ''}</div>
        <h3><a href="${siteBase}post.html?id=${encodeURIComponent(post.id)}">${highlight(post.title, query)}</a></h3>
        ${post.content ? `<p>${highlight(excerpt(post.content), query)}</p>` : ''}
        <div class="search-card-footer">
          <a class="read-more" href="${siteBase}post.html?id=${encodeURIComponent(post.id)}">Подробнее →</a>
          ${files ? `<span>${files} файл(ов)</span>` : ''}
        </div>
      </article>
    `;
  }).join('');

  results.innerHTML = pageHtml + postHtml;
}

async function runSearch() {
  const queryText = input.value.trim();
  const section = select.value;
  results.innerHTML = '<div class="empty-state">Поиск...</div>';
  summary.textContent = 'Загрузка результатов...';

  let query = supabase
    .from('site_posts')
    .select('id, section, title, content, category, files, metadata, published_at, created_at, sort_order')
    .eq('status', 'published')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(queryText ? 60 : 20);

  if (section) query = query.eq('section', section);
  if (queryText) {
    const safe = queryText.replace(/[%,]/g, ' ');
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%,category.ilike.%${safe}%`);
  }

  const { data, error } = await query;

  if (error) {
    results.innerHTML = `<div class="empty-state">Ошибка поиска: ${escapeHTML(error.message)}</div>`;
    summary.textContent = 'Ошибка загрузки.';
    return;
  }

  const pages = section ? [] : renderStaticPages(queryText);
  render(data || [], pages, queryText);
}

let timer = null;
input?.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 320);
});
select?.addEventListener('change', runSearch);
button?.addEventListener('click', runSearch);
input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') runSearch();
});

runSearch();
