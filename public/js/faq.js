import { supabase } from './supabaseClient.js';

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function stripTags(value = '') {
  return String(value || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '');
}

async function loadFaq() {
  const root = document.querySelector('[data-faq-list]');
  if (!root) return;
  const { data, error } = await supabase
    .from('site_posts')
    .select('id, title, content, category, published_at, sort_order')
    .eq('section', 'faq')
    .eq('status', 'published')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(100);

  if (error) {
    root.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    root.innerHTML = `
      <div class="faq-static">
        <details open><summary>Какие документы нужны для поступления?</summary><p>Актуальный список документов публикуется в разделе “Абитуриентам” и “Документы”.</p></details>
        <details><summary>Где посмотреть расписание?</summary><p>Откройте раздел “Расписание”. Там можно публиковать PDF, Word или Excel-файлы.</p></details>
        <details><summary>Как связаться с приёмной комиссией?</summary><p>Телефон: +7 7242 23-05-13. Email: kzmediccollege@mail.kz.</p></details>
      </div>`;
    return;
  }
  root.innerHTML = data.map((item, index) => `
    <details class="faq-item" ${index === 0 ? 'open' : ''}>
      <summary>${escapeHTML(item.title)} ${item.category ? `<span>${escapeHTML(item.category)}</span>` : ''}</summary>
      <div class="faq-answer">${stripTags(item.content || '')}</div>
    </details>
  `).join('');
}

loadFaq();
