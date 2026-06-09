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

function hasHtml(value = '') { return /<\/?[a-z][\s\S]*>/i.test(String(value)); }
function safeHref(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, window.location.origin);
    if (ALLOWED_URL_PROTOCOLS.includes(url.protocol)) return url.href;
  } catch { return ''; }
  return '';
}

function sanitizeHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html);
  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); return; }
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
  try { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)); }
  catch { return ''; }
}
function plainText(value = '') { return String(value).replace(/<[^>]*>/g, '').trim(); }
function excerpt(value = '', max = 190) {
  const text = plainText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
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
  let size = Number(bytes); let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
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
    link.href = objectUrl; link.download = safeName;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
  } catch { window.open(url, '_blank', 'noopener'); }
}
function postBadges(post) {
  const sort = Number(post.sort_order || 0);
  const important = sort >= 500 || String(post.category || '').toLowerCase() === 'важно';
  return [
    sort >= 1000 ? '<span class="post-badge post-badge--pin">Закреплено</span>' : '',
    important ? '<span class="post-badge post-badge--important">Важно</span>' : ''
  ].filter(Boolean).join('');
}
function renderFiles(files) {
  if (!files.length) return '';
  return `<div class="file-list">${files.map((file) => `
    <button class="file-btn js-download-file" type="button" data-url="${escapeHTML(file.url)}" data-name="${escapeHTML(file.name)}">
      <span>${extIcon(file.name)} Скачать: ${escapeHTML(file.name)}</span>${file.size ? `<small>${readableSize(file.size)}</small>` : ''}
    </button>`).join('')}</div>`;
}
function firstImage(post) {
  const files = Array.isArray(post.files) ? post.files : [];
  return post.image_url || files.find((file) => file.type?.startsWith('image/'))?.url || '';
}
function metaValue(post, key) { return (post.metadata && typeof post.metadata === 'object') ? (post.metadata[key] || '') : ''; }
function metaChips(values = []) { return values.filter(Boolean).map((value) => `<span>${escapeHTML(value)}</span>`).join(''); }

function renderPeoplePost(post) {
  const files = Array.isArray(post.files) ? post.files : [];
  const image = firstImage(post);
  const detailHref = `${siteBase}post.html?id=${encodeURIComponent(post.id)}`;
  const position = metaValue(post, 'position') || post.category || '';
  const department = metaValue(post, 'department') || '';
  const experience = metaValue(post, 'experience') || '';
  const qualification = metaValue(post, 'qualification') || '';
  const email = metaValue(post, 'email') || '';
  return `
    <article class="person-card" data-post-card data-category="${escapeHTML(post.category || '')}">
      <a class="person-photo" href="${detailHref}">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">` : '<span>👤</span>'}</a>
      <div class="person-body">
        <div class="post-badges">${postBadges(post)}</div>
        <h3><a href="${detailHref}">${escapeHTML(post.title)}</a></h3>
        ${position ? `<p class="person-position">${escapeHTML(position)}</p>` : ''}
        <div class="person-chips">${metaChips([department, experience, qualification])}</div>
        ${post.content ? `<p>${escapeHTML(excerpt(post.content, 160))}</p>` : ''}
        <div class="person-actions"><a class="read-more" href="${detailHref}">Подробнее →</a>${email ? `<a class="read-more" href="mailto:${escapeHTML(email)}">Email</a>` : ''}</div>
        ${renderFiles(files)}
      </div>
    </article>`;
}

function renderSpecialtyPost(post) {
  const files = Array.isArray(post.files) ? post.files : [];
  const detailHref = `${siteBase}post.html?id=${encodeURIComponent(post.id)}`;
  const code = metaValue(post, 'code');
  const duration = metaValue(post, 'duration');
  const form = metaValue(post, 'form');
  const qualification = metaValue(post, 'qualification');
  const basis = metaValue(post, 'basis');
  return `
    <article class="specialty-card specialty-card--dynamic" data-post-card data-category="${escapeHTML(post.category || '')}">
      <div class="post-badges">${postBadges(post)}</div>
      ${code ? `<div class="kicker">Код: ${escapeHTML(code)}</div>` : ''}
      <h3><a href="${detailHref}">${escapeHTML(post.title)}</a></h3>
      ${post.content ? `<p>${escapeHTML(excerpt(post.content, 180))}</p>` : ''}
      <div class="specialty-meta">${metaChips([duration, form, qualification, basis])}</div>
      <a class="read-more" href="${detailHref}">Подробнее →</a>
      ${renderFiles(files)}
    </article>`;
}

function renderPost(post, layout = 'list', variant = 'default') {
  if (variant === 'people') return renderPeoplePost(post);
  if (variant === 'specialty') return renderSpecialtyPost(post);
  const files = Array.isArray(post.files) ? post.files : [];
  const image = firstImage(post);
  const category = post.category ? `<span>${escapeHTML(post.category)}</span>` : '';
  const date = formatDate(post.published_at || post.created_at);
  const content = layout === 'cards' ? excerpt(post.content || '') : (post.content || '');
  const contentHtml = layout === 'cards' ? escapeHTML(content) : renderRichContent(content);
  const detailHref = `${siteBase}post.html?id=${encodeURIComponent(post.id)}`;
  const filesHtml = renderFiles(files);
  const deadline = metaValue(post, 'deadline');
  const contact = metaValue(post, 'contact');
  const actionLabel = metaValue(post, 'action_label');
  const actionUrl = safeHref(metaValue(post, 'action_url'));
  return `
    <article class="post-card" data-post-card data-category="${escapeHTML(post.category || '')}">
      ${image ? `<a href="${detailHref}" aria-label="Подробнее: ${escapeHTML(post.title)}"><img class="post-card__image" src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}"></a>` : ''}
      <div class="post-card__body">
        <div class="post-badges">${postBadges(post)}</div>
        <div class="post-meta">${category}${date ? `<span>${date}</span>` : ''}${deadline ? `<span>Срок: ${escapeHTML(deadline)}</span>` : ''}</div>
        <h3><a href="${detailHref}">${escapeHTML(post.title)}</a></h3>
        ${content ? (layout === 'cards' ? `<p>${contentHtml}</p>` : `<div class="post-card__content">${contentHtml}</div>`) : ''}
        ${contact ? `<p class="small-note">Контакт: ${escapeHTML(contact)}</p>` : ''}
        <div class="post-actions-row"><a class="read-more" href="${detailHref}">Подробнее →</a>${actionUrl && actionLabel ? `<a class="read-more" href="${escapeHTML(actionUrl)}" target="_blank" rel="noopener">${escapeHTML(actionLabel)}</a>` : ''}</div>
        ${filesHtml}
      </div>
    </article>`;
}

async function loadList(root) {
  const section = root.dataset.section;
  const limit = Number(root.dataset.limit || 30);
  const empty = root.dataset.empty || 'Материалы пока не добавлены.';
  const category = root.dataset.category;
  const layout = root.dataset.layout || (root.classList.contains('cards') ? 'cards' : 'list');
  const variant = root.dataset.variant || 'default';
  let query = supabase
    .from('site_posts')
    .select('id, section, title, content, category, status, image_url, files, metadata, published_at, created_at, sort_order')
    .eq('section', section)
    .eq('status', 'published')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) { root.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`; return; }
  if (!data || data.length === 0) { root.innerHTML = `<div class="empty-state">${escapeHTML(empty)}</div>`; return; }
  root.innerHTML = data.map((post) => renderPost(post, layout, variant)).join('');
  root.querySelectorAll('.js-download-file').forEach((btn) => btn.addEventListener('click', () => forceDownload(btn.dataset.url, btn.dataset.name)));
  applyCategoryFilter(document.querySelector('[data-filter-category].active')?.dataset.filterCategory || '');
}

function applyCategoryFilter(category) {
  const cards = document.querySelectorAll('[data-post-card]');
  if (!cards.length) return;
  cards.forEach((card) => {
    const cardCategory = (card.dataset.category || '').trim().toLowerCase();
    const selected = (category || '').trim().toLowerCase();
    card.hidden = Boolean(selected) && cardCategory !== selected;
  });
}

const initialized = new WeakSet();
document.querySelectorAll('[data-post-list]').forEach((root) => { if (!initialized.has(root)) { initialized.add(root); loadList(root); } });
document.querySelectorAll('[data-filter-category]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter-category]').forEach((item) => item.classList.remove('active'));
    btn.classList.add('active');
    applyCategoryFilter(btn.dataset.filterCategory || '');
  });
});
