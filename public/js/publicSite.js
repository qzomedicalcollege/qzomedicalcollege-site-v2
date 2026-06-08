import { supabase } from './supabaseClient.js';

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

function extIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '📄';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📊';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return '📑';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return '🖼️';
  return '📎';
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

function renderPost(post) {
  const files = Array.isArray(post.files) ? post.files : [];
  const image = post.image_url || files.find((file) => file.type?.startsWith('image/'))?.url || '';
  const category = post.category ? `<span>${escapeHTML(post.category)}</span>` : '';
  const date = formatDate(post.published_at || post.created_at);
  const filesHtml = files.length ? `
    <div class="file-list">
      ${files.map((file) => `
        <button class="file-btn js-download-file" type="button" data-url="${escapeHTML(file.url)}" data-name="${escapeHTML(file.name)}">
          ${extIcon(file.name)} Скачать: ${escapeHTML(file.name)}
        </button>
      `).join('')}
    </div>
  ` : '';

  return `
    <article class="post-card">
      ${image ? `<img class="post-card__image" src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">` : ''}
      <div class="post-card__body">
        <div class="post-meta">${category}${date ? `<span>${date}</span>` : ''}</div>
        <h3>${escapeHTML(post.title)}</h3>
        <p>${escapeHTML(post.content).replace(/\n/g, '<br>')}</p>
        ${filesHtml}
      </div>
    </article>
  `;
}

async function loadList(root) {
  const section = root.dataset.section;
  const limit = Number(root.dataset.limit || 30);
  const empty = root.dataset.empty || 'Материалы пока не добавлены.';
  const category = root.dataset.category;

  let query = supabase
    .from('site_posts')
    .select('id, section, title, content, category, status, image_url, files, published_at, created_at, sort_order')
    .eq('section', section)
    .eq('status', 'published')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) {
    root.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    root.innerHTML = `<div class="empty-state">${escapeHTML(empty)}</div>`;
    return;
  }

  root.innerHTML = data.map(renderPost).join('');
  root.querySelectorAll('.js-download-file').forEach((btn) => {
    btn.addEventListener('click', () => forceDownload(btn.dataset.url, btn.dataset.name));
  });
}

const initialized = new WeakSet();

document.querySelectorAll('[data-post-list]').forEach((root) => {
  if (!initialized.has(root)) {
    initialized.add(root);
    loadList(root);
  }
});
