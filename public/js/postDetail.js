import { supabase } from './supabaseClient.js';

const siteBase = (() => {
  const raw = window.SITE_BASE || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}


const ALLOWED_HTML_TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

function hasHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

function safeHref(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, window.location.origin);
    if (ALLOWED_URL_PROTOCOLS.includes(url.protocol)) return url.href;
  } catch {
    return '';
  }
  return '';
}

function sanitizeHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html);

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const tag = node.tagName;
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
      return;
    }

    const hrefBeforeClean = tag === 'A' ? node.getAttribute('href') : '';
    [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));

    if (tag === 'A') {
      const href = safeHref(hrefBeforeClean || node.textContent || '');
      if (href) {
        node.setAttribute('href', href);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        node.remove();
        return;
      }
    }

    [...node.childNodes].forEach(cleanNode);
  }

  [...template.content.childNodes].forEach(cleanNode);
  return template.innerHTML.trim();
}

function renderRichContent(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasHtml(raw)) return sanitizeHtml(raw);
  return escapeHTML(raw).replace(/\n/g, '<br>');
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

function extIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '📄';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📊';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return '📑';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return '🖼️';
  return '📎';
}

function readableSize(bytes = 0) {
  if (!bytes) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function forceDownload(url, filename) {
  const safeName = filename || 'download';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    window.open(url, '_blank', 'noopener');
  }
}


function postBadges(post) {
  const sort = Number(post.sort_order || 0);
  const important = sort >= 500 || String(post.category || '').toLowerCase() === 'важно';
  return [
    sort >= 1000 ? '<span class="post-badge post-badge--pin">Закреплено</span>' : '',
    important ? '<span class="post-badge post-badge--important">Важно</span>' : ''
  ].filter(Boolean).join('');
}

function sectionBackLink(section) {
  const map = {
    news: ['Новости', 'news.html'],
    about: ['О колледже', 'about.html'],
    admission: ['Абитуриентам', 'admission.html'],
    students: ['Студентам', 'students.html'],
    specialties: ['Специальности', 'specialties.html'],
    documents: ['Документы', 'documents.html'],
    schedule: ['Расписание', 'schedule.html'],
    announcements: ['Объявления', 'announcements.html'],
    gallery: ['Галерея', 'gallery.html'],
    teachers: ['Преподаватели', 'teachers.html'],
    management: ['Руководство', 'management.html'],
    faq: ['FAQ', 'faq.html']
  };
  return map[section] || ['На главную', 'index.html'];
}

function renderFiles(files = []) {
  if (!files.length) return '';
  return `
    <section class="detail-files">
      <h2>Прикреплённые файлы</h2>
      <div class="file-list">
        ${files.map((file) => `
          <button class="file-btn js-download-file" type="button" data-url="${escapeHTML(file.url)}" data-name="${escapeHTML(file.name)}">
            <span>${extIcon(file.name)} Скачать: ${escapeHTML(file.name)}</span>
            ${file.size ? `<small>${readableSize(file.size)}</small>` : ''}
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function metadataFacts(post) {
  const meta = post.metadata && typeof post.metadata === 'object' ? post.metadata : {};
  const labels = {
    position: 'Должность', department: 'Отдел / комиссия', experience: 'Стаж', qualification: 'Квалификация', email: 'Email', contact: 'Контакт',
    code: 'Код', duration: 'Срок обучения', form: 'Форма', basis: 'База поступления',
    event_date: 'Дата мероприятия', location: 'Место', audience: 'Участники',
    deadline: 'Срок', action_label: 'Действие'
  };
  const items = Object.entries(meta).filter(([key, value]) => value && key !== 'action_url');
  if (!items.length) return '';
  return `<div class="detail-facts">${items.map(([key, value]) => `<div><strong>${escapeHTML(value)}</strong><span>${escapeHTML(labels[key] || key)}</span></div>`).join('')}</div>`;
}

function renderPost(root, post) {
  const files = Array.isArray(post.files) ? post.files : [];
  const image = post.image_url || files.find((file) => file.type?.startsWith('image/'))?.url || '';
  const date = formatDate(post.published_at || post.created_at);
  const [label, href] = sectionBackLink(post.section);

  document.title = `${post.title} — Қызылорда жоғары медициналық колледжі`;

  root.innerHTML = `
    <article class="detail-card">
      <a class="read-more" href="${siteBase}${href}">← ${escapeHTML(label)}</a>
      <div class="post-badges" style="margin-top: 18px;">${postBadges(post)}</div>
      <div class="post-meta">
        ${post.category ? `<span>${escapeHTML(post.category)}</span>` : ''}
        ${date ? `<span>${date}</span>` : ''}
      </div>
      <h1>${escapeHTML(post.title)}</h1>
      ${metadataFacts(post)}
      ${image ? `<img class="detail-image" src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">` : ''}
      ${post.content ? `<div class="detail-content">${renderRichContent(post.content)}</div>` : ''}
      ${renderFiles(files)}
    </article>
  `;

  root.querySelectorAll('.js-download-file').forEach((btn) => {
    btn.addEventListener('click', () => forceDownload(btn.dataset.url, btn.dataset.name));
  });
}

async function init() {
  const root = document.getElementById('postDetailRoot');
  const id = new URLSearchParams(window.location.search).get('id');
  if (!root) return;
  if (!id) {
    root.innerHTML = '<div class="empty-state">Запись не найдена: отсутствует ID.</div>';
    return;
  }

  const { data, error } = await supabase
    .from('site_posts')
    .select('id, section, title, content, category, status, image_url, files, metadata, published_at, created_at, sort_order')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    root.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`;
    return;
  }

  if (!data) {
    root.innerHTML = `<div class="empty-state">Запись не найдена или не опубликована.<br><br><a class="btn btn-primary" href="${siteBase}index.html">На главную</a></div>`;
    return;
  }

  renderPost(root, data);
}

init();
