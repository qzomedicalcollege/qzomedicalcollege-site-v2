import { supabase } from './supabaseClient.js';

function escapeHTML(value) { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; }
function formatDate(value) { try { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)); } catch { return ''; } }
function stripHtml(value='') { return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function imageFiles(post) {
  const files = Array.isArray(post.files) ? post.files : [];
  return files.filter((file) => String(file.type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name || ''));
}

const dialog = document.querySelector('[data-lightbox]');
const dialogImage = document.querySelector('[data-lightbox-image]');
const dialogCaption = document.querySelector('[data-lightbox-caption]');
let galleryImages = [];
let currentIndex = 0;

function openLightbox(index) {
  if (!galleryImages[index]) return;
  currentIndex = index;
  dialogImage.src = galleryImages[index].url;
  dialogCaption.textContent = galleryImages[index].caption || '';
  dialog?.showModal();
}
function moveLightbox(delta) {
  if (!galleryImages.length) return;
  currentIndex = (currentIndex + delta + galleryImages.length) % galleryImages.length;
  openLightbox(currentIndex);
}

async function loadGallery() {
  const root = document.querySelector('[data-gallery-list]');
  if (!root) return;
  const { data, error } = await supabase
    .from('site_posts')
    .select('id, title, content, category, image_url, files, metadata, published_at, created_at, sort_order')
    .eq('section', 'gallery')
    .eq('status', 'published')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(60);
  if (error) { root.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`; return; }
  if (!data?.length) { root.innerHTML = '<div class="empty-state">Фотоальбомы пока не добавлены.</div>'; return; }

  galleryImages = [];
  root.innerHTML = data.map((post) => {
    const images = imageFiles(post);
    const cover = post.image_url || images[0]?.url || '';
    const date = post.metadata?.event_date ? formatDate(post.metadata.event_date) : formatDate(post.published_at || post.created_at);
    const location = post.metadata?.location || '';
    const audience = post.metadata?.audience || '';
    const startIndex = galleryImages.length;
    images.forEach((img) => galleryImages.push({ url: img.url, caption: `${post.title}${img.name ? ` — ${img.name}` : ''}` }));
    return `
      <article class="album-card pro-album">
        ${cover ? `<button type="button" class="album-cover" data-lightbox-index="${startIndex}" aria-label="Открыть альбом: ${escapeHTML(post.title)}"><img src="${escapeHTML(cover)}" alt="${escapeHTML(post.title)}"><span class="album-count">${images.length} фото</span></button>` : '<div class="album-cover album-cover--empty">Нет фото</div>'}
        <div class="album-body">
          <div class="post-meta">${post.category ? `<span>${escapeHTML(post.category)}</span>` : ''}${date ? `<span>${date}</span>` : ''}${location ? `<span>${escapeHTML(location)}</span>` : ''}</div>
          <h3>${escapeHTML(post.title)}</h3>
          ${post.content ? `<p>${escapeHTML(stripHtml(post.content).slice(0, 190))}</p>` : ''}
          ${audience ? `<p class="small-note">Участники: ${escapeHTML(audience)}</p>` : ''}
          <div class="album-thumbs">
            ${images.slice(0, 10).map((img, idx) => `<button type="button" data-lightbox-index="${startIndex + idx}"><img src="${escapeHTML(img.url)}" alt="${escapeHTML(img.name || post.title)}"></button>`).join('')}
          </div>
        </div>
      </article>`;
  }).join('');
}

document.addEventListener('click', (event) => {
  const indexed = event.target.closest('[data-lightbox-index]');
  if (indexed) openLightbox(Number(indexed.dataset.lightboxIndex || 0));
  if (event.target.closest('[data-lightbox-close]')) dialog?.close();
  if (event.target.closest('[data-lightbox-prev]')) moveLightbox(-1);
  if (event.target.closest('[data-lightbox-next]')) moveLightbox(1);
});
document.addEventListener('keydown', (event) => {
  if (!dialog?.open) return;
  if (event.key === 'ArrowLeft') moveLightbox(-1);
  if (event.key === 'ArrowRight') moveLightbox(1);
});
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
loadGallery();
