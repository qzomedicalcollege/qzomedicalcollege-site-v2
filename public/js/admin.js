import { supabase } from './supabaseClient.js';
import { SUPABASE_BUCKET, ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB, SECTIONS } from './config.js';

const $ = (id) => document.getElementById(id);

const loginPanel = $('loginPanel');
const dashboardPanel = $('dashboardPanel');
const loginForm = $('loginForm');
const loginNotice = $('loginNotice');
const logoutBtn = $('logoutBtn');
const postForm = $('postForm');
const formTitle = $('formTitle');
const formModeBadge = $('formModeBadge');
const formNotice = $('formNotice');
const postsList = $('postsList');
const resetBtn = $('resetBtn');
const saveBtn = $('saveBtn');
const previewBtn = $('previewBtn');
const refreshBtn = $('refreshBtn');
const existingFilesBox = $('existingFiles');
const filterSection = $('filterSection');
const filterStatus = $('filterStatus');
const filterCategory = $('filterCategory');
const searchInput = $('searchInput');
const categorySuggestions = $('categorySuggestions');
const previewDialog = $('previewDialog');
const closePreviewBtn = $('closePreviewBtn');
const previewContent = $('previewContent');
const contentEditor = $('contentEditor');
const refreshLogBtn = $('refreshLogBtn');
const activityLogList = $('activityLogList');

const PINNED_SORT = 1000;
const IMPORTANT_SORT = 500;

const CATEGORY_PRESETS = {
  news: ['События', 'Достижения', 'Мероприятия', 'Важно'],
  announcements: ['Важно', 'Приём документов', 'Расписание', 'Практика', 'Экзамены', 'Собрания'],
  about: ['История', 'Миссия', 'Аккредитация', 'Руководство'],
  admission: ['Поступление', 'Документы', 'Гранты', 'Приёмная комиссия', 'FAQ', 'Важно'],
  students: ['Практика', 'Учебный процесс', 'Объявления', 'Методические материалы', 'Важно'],
  specialties: ['Мейіргер ісі', 'Емдеу ісі', 'Акушерлік іс', 'Фармация', 'Зертханалық диагностика'],
  documents: ['Лицензии', 'Аккредитация', 'Приказы', 'Правила', 'Образовательные программы', 'Расписание', 'Практика', 'Для студентов', 'Для абитуриентов', 'Важно'],
  schedule: ['Занятия', 'Экзамены', 'Практика', 'Сессия', 'Важно'],
  gallery: ['Мероприятия', 'Практика', 'Конкурсы', 'Студенческая жизнь', 'Встречи'],
  teachers: ['Общеобразовательные дисциплины', 'Специальные дисциплины', 'Клинические дисциплины', 'Методический кабинет'],
  management: ['Директор', 'Заместители', 'Заведующие отделениями', 'Методический кабинет'],
  faq: ['Поступление', 'Обучение', 'Документы', 'Расписание', 'Практика', 'Контакты']
};

const siteBase = (() => {
  const raw = window.SITE_BASE || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

let allPosts = [];
let currentFiles = [];
let currentUser = null;

function showNotice(el, message, type = 'ok') {
  if (!el) return;
  el.className = `notice ${type}`;
  el.textContent = message;
}

function clearNotice(el) {
  if (!el) return;
  el.className = 'notice';
  el.textContent = '';
}

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

    [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));

    if (tag === 'A') {
      const href = safeHref(node.getAttribute('href') || node.textContent || '');
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

function textToEditorHtml(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasHtml(raw)) return sanitizeHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHTML(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function getEditorHtml() {
  const html = sanitizeHtml(contentEditor?.innerHTML || '');
  const text = contentEditor?.textContent?.replace(/\u00a0/g, ' ').trim() || '';
  return text ? html : '';
}

function setEditorHtml(value = '') {
  if (!contentEditor) return;
  contentEditor.innerHTML = textToEditorHtml(value);
  $('contentInput').value = getEditorHtml();
}

function syncEditorToTextarea() {
  if ($('contentInput')) $('contentInput').value = getEditorHtml();
}

function insertEditorHtml(html) {
  contentEditor?.focus();
  document.execCommand('insertHTML', false, html);
  syncEditorToTextarea();
}

function setupRichEditor() {
  if (!contentEditor) return;
  contentEditor.addEventListener('input', syncEditorToTextarea);
  contentEditor.addEventListener('paste', (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain');
    insertEditorHtml(html ? sanitizeHtml(html) : textToEditorHtml(text || ''));
  });

  document.querySelectorAll('[data-editor-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.dataset.editorCommand;
      let value = button.dataset.editorValue || null;
      contentEditor.focus();
      if (command === 'createLink') {
        const href = prompt('Вставь ссылку, например https://example.kz');
        const safe = safeHref(href || '');
        if (!safe) return;
        document.execCommand('createLink', false, safe);
        contentEditor.querySelectorAll('a').forEach((link) => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
      } else if (command === 'formatBlock' && value) {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command, false, value);
      }
      syncEditorToTextarea();
    });
  });

  document.querySelectorAll('[data-editor-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.editorAction;
      if (action === 'quote') insertEditorHtml('<blockquote>Цитата или важное примечание</blockquote>');
      if (action === 'table') insertEditorHtml('<table><tbody><tr><th>Показатель</th><th>Значение</th></tr><tr><td>Название</td><td>Данные</td></tr></tbody></table>');
    });
  });
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
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

function toLocalInputValue(dateLike) {
  const date = dateLike ? new Date(dateLike) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function transliterateToAscii(value = '') {
  const map = {
    а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd',
    е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
    к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n',
    о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h', һ: 'h',
    ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
    ы: 'y', і: 'i', э: 'e', ю: 'yu', я: 'ya',
    ь: '', ъ: ''
  };

  return String(value)
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      return map[lower] ?? char;
    })
    .join('');
}

function sanitizeFileName(name) {
  const original = String(name || 'file');
  const lastDotIndex = original.lastIndexOf('.');

  const rawBase = lastDotIndex > 0
    ? original.slice(0, lastDotIndex)
    : original;

  const rawExt = lastDotIndex > 0
    ? original.slice(lastDotIndex + 1)
    : 'file';

  const safeBase = transliterateToAscii(rawBase)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 90) || 'file';

  const safeExt = transliterateToAscii(rawExt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') || 'bin';

  return `${safeBase}.${safeExt}`;
}
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

function isAllowedFile(file) {
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) return `Файл «${file.name}» больше ${MAX_FILE_SIZE_MB} МБ.`;
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    const lower = file.name.toLowerCase();
    const allowedByExt = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|webp|gif)$/.test(lower);
    if (!allowedByExt) return `Тип файла «${file.name}» запрещён.`;
  }
  return '';
}

function fileIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '📄';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📊';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return '📑';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return '🖼️';
  return '📎';
}

function badges(post) {
  const sort = Number(post.sort_order || 0);
  const important = sort >= IMPORTANT_SORT || String(post.category || '').toLowerCase() === 'важно';
  return [
    sort >= PINNED_SORT ? '<span class="admin-badge pin">Закреплено</span>' : '',
    important ? '<span class="admin-badge important">Важно</span>' : '',
    post.files?.length ? `<span class="admin-badge file">${post.files.length} файл.</span>` : ''
  ].filter(Boolean).join('');
}

function updateCategorySuggestions() {
  const section = $('sectionInput')?.value || 'news';
  const presets = CATEGORY_PRESETS[section] || [];
  const dynamic = [...new Set(allPosts.filter((post) => post.section === section).map((post) => post.category).filter(Boolean))];
  const values = [...new Set([...presets, ...dynamic])];
  categorySuggestions.innerHTML = values.map((value) => `<option value="${escapeHTML(value)}"></option>`).join('');
}

function updateCategoryFilter() {
  const selected = filterCategory.value;
  const categories = [...new Set(allPosts.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  filterCategory.innerHTML = '<option value="">Все категории</option>' + categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
  if (categories.includes(selected)) filterCategory.value = selected;
}

function updateStats() {
  const filesCount = allPosts.reduce((sum, post) => sum + (Array.isArray(post.files) ? post.files.length : 0), 0);
  $('statsTotal').textContent = allPosts.length;
  $('statsPublished').textContent = allPosts.filter((post) => post.status === 'published').length;
  $('statsDrafts').textContent = allPosts.filter((post) => post.status === 'draft').length;
  $('statsFiles').textContent = filesCount;
}

function renderExistingFiles() {
  if (!currentFiles.length) {
    existingFilesBox.innerHTML = '';
    return;
  }
  existingFilesBox.innerHTML = currentFiles.map((file, index) => `
    <div class="admin-file-row">
      <div>
        <strong>${fileIcon(file.name)} ${escapeHTML(file.name)}</strong>
        <small>${escapeHTML(file.type || 'file')}${file.size ? ` · ${readableSize(file.size)}` : ''}</small>
      </div>
      <div class="admin-file-actions">
        ${file.url ? `<a class="btn btn-muted btn-small" href="${escapeHTML(file.url)}" target="_blank" rel="noopener">Открыть</a>` : ''}
        <button class="btn btn-danger btn-small" type="button" data-remove-file="${index}">Убрать</button>
      </div>
    </div>
  `).join('');
  existingFilesBox.querySelectorAll('[data-remove-file]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.removeFile);
      currentFiles.splice(index, 1);
      renderExistingFiles();
      showNotice(formNotice, 'Файл убран из записи. Нажми “Сохранить”, чтобы удалить его из Storage.', 'ok');
    });
  });
}


function actionLabel(action) {
  return {
    create: 'Создание',
    update: 'Редактирование',
    delete: 'Удаление',
    status: 'Смена статуса',
    duplicate: 'Дублирование',
    files_remove: 'Удаление файлов',
    login: 'Вход'
  }[action] || action;
}

async function logActivity(action, post = null, extra = {}) {
  try {
    if (!currentUser) return;
    await supabase.from('admin_activity_logs').insert({
      user_id: currentUser.id,
      action,
      entity: 'site_posts',
      entity_id: post?.id || extra.entity_id || null,
      details: {
        title: post?.title || extra.title || '',
        section: post?.section || extra.section || '',
        ...extra
      }
    });
  } catch (err) {
    console.warn('Activity log skipped:', err.message);
  }
}

function renderActivityLogs(logs = []) {
  if (!activityLogList) return;
  if (!logs.length) {
    activityLogList.innerHTML = '<div class="empty-state">Пока нет записей в журнале.</div>';
    return;
  }
  activityLogList.innerHTML = logs.map((log) => {
    const details = log.details || {};
    const title = details.title || details.section || 'Без названия';
    const date = formatDate(log.created_at);
    return `
      <article class="activity-item">
        <div>
          <strong>${escapeHTML(actionLabel(log.action))}</strong>
          <span>${escapeHTML(title)}</span>
        </div>
        <small>${escapeHTML(date)} · ${escapeHTML(SECTIONS[details.section] || details.section || log.entity || '')}</small>
      </article>
    `;
  }).join('');
}

async function loadActivityLogs() {
  if (!activityLogList) return;
  activityLogList.innerHTML = '<div class="empty-state">Загрузка журнала...</div>';
  const { data, error } = await supabase
    .from('admin_activity_logs')
    .select('id, action, entity, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    activityLogList.innerHTML = `<div class="empty-state">Журнал недоступен. Выполни supabase/upgrade-megaplus.sql.<br><small>${escapeHTML(error.message)}</small></div>`;
    return;
  }
  renderActivityLogs(data || []);
}

async function checkAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  currentUser = sessionData.session?.user || null;
  if (!currentUser) return false;

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) {
    showNotice(loginNotice, `Ошибка проверки админа: ${error.message}`, 'err');
    return false;
  }
  return Boolean(data);
}

async function updateAuthState() {
  const isAdmin = await checkAdmin();
  loginPanel.hidden = isAdmin;
  dashboardPanel.hidden = !isAdmin;
  logoutBtn.hidden = !isAdmin;
  if (isAdmin) {
    await loadPosts();
    await loadActivityLogs();
  }
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice(loginNotice);
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showNotice(loginNotice, `Ошибка входа: ${error.message}`, 'err');
    return;
  }
  const isAdmin = await checkAdmin();
  if (!isAdmin) {
    await supabase.auth.signOut();
    showNotice(loginNotice, 'Этот пользователь не добавлен в admin_users.', 'err');
    return;
  }
  await logActivity('login', null, { title: currentUser?.email || 'admin' });
  await updateAuthState();
});

logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  dashboardPanel.hidden = true;
  loginPanel.hidden = false;
  logoutBtn.hidden = true;
});

async function uploadFiles(section, files) {
  const uploaded = [];
  for (const file of files) {
    const validationError = isAllowedFile(file);
    if (validationError) throw new Error(validationError);

    const safeName = sanitizeFileName(file.name);
    const path = `${section}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    uploaded.push({
      name: file.name,
      path,
      url: publicData.publicUrl,
      type: file.type,
      size: file.size
    });
  }
  return uploaded;
}

async function removeStorageFiles(files = []) {
  const paths = files.map((file) => file.path).filter(Boolean);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove(paths);
  if (error) throw error;
}


function fieldValue(id) {
  return ($(id)?.value || '').trim();
}

function getMetadata() {
  const section = $('sectionInput').value;
  const metadata = {};
  if (['teachers', 'management'].includes(section)) {
    Object.assign(metadata, {
      position: fieldValue('personPositionInput'),
      department: fieldValue('personDepartmentInput'),
      experience: fieldValue('personExperienceInput'),
      qualification: fieldValue('personQualificationInput'),
      email: fieldValue('personEmailInput'),
      contact: fieldValue('personContactInput')
    });
  }
  if (section === 'specialties') {
    Object.assign(metadata, {
      code: fieldValue('specialtyCodeInput'),
      duration: fieldValue('specialtyDurationInput'),
      form: fieldValue('specialtyFormInput'),
      qualification: fieldValue('specialtyQualificationInput'),
      basis: fieldValue('specialtyBasisInput')
    });
  }
  if (section === 'gallery') {
    Object.assign(metadata, {
      event_date: fieldValue('galleryDateInput'),
      location: fieldValue('galleryLocationInput'),
      audience: fieldValue('galleryAudienceInput')
    });
  }
  if (['admission', 'announcements'].includes(section)) {
    Object.assign(metadata, {
      deadline: fieldValue('admissionDeadlineInput'),
      contact: fieldValue('admissionContactInput'),
      action_label: fieldValue('admissionActionInput'),
      action_url: fieldValue('admissionActionUrlInput')
    });
  }
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== ''));
}

function setMetadata(metadata = {}) {
  const set = (id, value = '') => { if ($(id)) $(id).value = value || ''; };
  set('personPositionInput', metadata.position);
  set('personDepartmentInput', metadata.department);
  set('personExperienceInput', metadata.experience);
  set('personQualificationInput', metadata.qualification);
  set('personEmailInput', metadata.email);
  set('personContactInput', metadata.contact);
  set('specialtyCodeInput', metadata.code);
  set('specialtyDurationInput', metadata.duration);
  set('specialtyFormInput', metadata.form);
  set('specialtyQualificationInput', metadata.qualification);
  set('specialtyBasisInput', metadata.basis);
  set('galleryDateInput', metadata.event_date);
  set('galleryLocationInput', metadata.location);
  set('galleryAudienceInput', metadata.audience);
  set('admissionDeadlineInput', metadata.deadline);
  set('admissionContactInput', metadata.contact);
  set('admissionActionInput', metadata.action_label);
  set('admissionActionUrlInput', metadata.action_url);
}

function updateSectionFields() {
  const section = $('sectionInput')?.value || '';
  document.querySelectorAll('[data-section-fields]').forEach((box) => {
    const sections = (box.dataset.sectionFields || '').split(/\s+/).filter(Boolean);
    box.hidden = !sections.includes(section);
  });
}

function getPayload(files) {
  const section = $('sectionInput').value;
  let category = $('categoryInput').value.trim() || null;
  let sortOrder = Number($('sortInput').value || 0);

  if ($('pinnedInput').checked && sortOrder < PINNED_SORT) sortOrder = PINNED_SORT;
  if (!$('pinnedInput').checked && $('importantInput').checked && sortOrder < IMPORTANT_SORT) sortOrder = IMPORTANT_SORT;
  if ($('importantInput').checked && !category) category = 'Важно';

  const firstImage = files.find((file) => file.type?.startsWith('image/'));
  return {
    section,
    status: $('statusInput').value,
    title: $('titleInput').value.trim(),
    category,
    content: getEditorHtml() || null,
    sort_order: sortOrder,
    published_at: $('publishedAtInput').value ? new Date($('publishedAtInput').value).toISOString() : new Date().toISOString(),
    files,
    image_url: firstImage?.url || null,
    metadata: getMetadata(),
    updated_at: new Date().toISOString()
  };
}

postForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice(formNotice);
  saveBtn.disabled = true;
  saveBtn.textContent = 'Сохранение...';

  try {
    const id = $('postId').value || null;
    const section = $('sectionInput').value;
    const newFileList = Array.from($('filesInput').files || []);
    const uploadedFiles = await uploadFiles(section, newFileList);
    const files = [...currentFiles, ...uploadedFiles];
    const oldPost = id ? allPosts.find((item) => item.id === id) : null;
    const oldFiles = Array.isArray(oldPost?.files) ? oldPost.files : [];
    const payload = getPayload(files);

    if (!payload.title) throw new Error('Введите заголовок.');

    const result = id
      ? await supabase.from('site_posts').update(payload).eq('id', id).select('id').maybeSingle()
      : await supabase.from('site_posts').insert(payload).select('id').maybeSingle();

    if (result.error) throw result.error;

    const savedPost = { ...payload, id: id || result.data?.id };
    await logActivity(id ? 'update' : 'create', savedPost, { files_count: files.length });

    if (id && oldFiles.length) {
      const newPaths = new Set(files.map((file) => file.path).filter(Boolean));
      const removedFiles = oldFiles.filter((file) => file.path && !newPaths.has(file.path));
      if (removedFiles.length) {
        await removeStorageFiles(removedFiles);
        await logActivity('files_remove', savedPost, { files_count: removedFiles.length });
      }
    }

    showNotice(formNotice, id ? 'Запись обновлена.' : 'Запись опубликована.', 'ok');
    resetForm();
    await loadPosts();
    await loadActivityLogs();
  } catch (err) {
    showNotice(formNotice, `Ошибка: ${err.message}`, 'err');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = $('postId').value ? 'Сохранить изменения' : 'Опубликовать';
  }
});

function resetForm() {
  postForm.reset();
  setEditorHtml('');
  $('postId').value = '';
  $('sortInput').value = '0';
  $('publishedAtInput').value = toLocalInputValue(new Date());
  $('pinnedInput').checked = false;
  $('importantInput').checked = false;
  currentFiles = [];
  setMetadata({});
  updateSectionFields();
  formTitle.textContent = 'Новая запись';
  formModeBadge.textContent = 'создание';
  formModeBadge.className = 'status draft';
  saveBtn.textContent = 'Опубликовать';
  renderExistingFiles();
  updateCategorySuggestions();
}

resetBtn?.addEventListener('click', resetForm);
refreshBtn?.addEventListener('click', async () => { await loadPosts(); await loadActivityLogs(); });
refreshLogBtn?.addEventListener('click', loadActivityLogs);

async function loadPosts() {
  postsList.innerHTML = '<div class="empty-state">Загрузка...</div>';
  const { data, error } = await supabase
    .from('site_posts')
    .select('*')
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(300);

  if (error) {
    postsList.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`;
    return;
  }

  allPosts = data || [];
  updateStats();
  updateCategoryFilter();
  updateCategorySuggestions();
  renderPosts();
}

function renderPosts() {
  const section = filterSection.value;
  const status = filterStatus.value;
  const category = filterCategory.value;
  const search = searchInput.value.trim().toLowerCase();
  const filtered = allPosts.filter((post) => {
    const bySection = !section || post.section === section;
    const byStatus = !status || post.status === status;
    const byCategory = !category || post.category === category;
    const bySearch = !search || `${post.title || ''} ${post.content || ''} ${post.category || ''}`.toLowerCase().includes(search);
    return bySection && byStatus && byCategory && bySearch;
  });

  if (!filtered.length) {
    postsList.innerHTML = '<div class="empty-state">Записей нет.</div>';
    return;
  }

  postsList.innerHTML = filtered.map((post) => {
    const date = formatDate(post.published_at || post.created_at);
    const detailUrl = `${siteBase}post.html?id=${encodeURIComponent(post.id)}`;
    return `
      <article class="admin-post" data-id="${escapeHTML(post.id)}">
        <div class="admin-post-title-row">
          <h4>${escapeHTML(post.title)}</h4>
          <span class="status ${post.status}">${post.status === 'published' ? 'Опубликовано' : 'Черновик'}</span>
        </div>
        <small>${escapeHTML(SECTIONS[post.section] || post.section)} · ${post.category ? escapeHTML(post.category) + ' · ' : ''}${date}</small>
        <div class="admin-badges">${badges(post)}</div>
        <div class="admin-post-actions">
          <button class="btn btn-muted" type="button" data-edit="${escapeHTML(post.id)}">Редактировать</button>
          <button class="btn btn-muted" type="button" data-duplicate="${escapeHTML(post.id)}">Дублировать</button>
          <button class="btn btn-muted" type="button" data-toggle-status="${escapeHTML(post.id)}">${post.status === 'published' ? 'В черновик' : 'Опубликовать'}</button>
          <button class="btn btn-muted" type="button" data-copy-link="${escapeHTML(detailUrl)}">Ссылка</button>
          <button class="btn btn-danger" type="button" data-delete="${escapeHTML(post.id)}">Удалить</button>
        </div>
      </article>
    `;
  }).join('');

  postsList.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => editPost(btn.dataset.edit)));
  postsList.querySelectorAll('[data-duplicate]').forEach((btn) => btn.addEventListener('click', () => duplicatePost(btn.dataset.duplicate)));
  postsList.querySelectorAll('[data-toggle-status]').forEach((btn) => btn.addEventListener('click', () => toggleStatus(btn.dataset.toggleStatus)));
  postsList.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', () => deletePost(btn.dataset.delete)));
  postsList.querySelectorAll('[data-copy-link]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copyLink);
      btn.textContent = 'Скопировано';
      setTimeout(() => { btn.textContent = 'Ссылка'; }, 1500);
    } catch {
      prompt('Скопируй ссылку:', btn.dataset.copyLink);
    }
  }));
}

function editPost(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  $('postId').value = post.id;
  $('sectionInput').value = post.section;
  $('statusInput').value = post.status;
  $('titleInput').value = post.title || '';
  $('categoryInput').value = post.category || '';
  setEditorHtml(post.content || '');
  $('sortInput').value = post.sort_order || 0;
  $('publishedAtInput').value = toLocalInputValue(post.published_at || post.created_at);
  $('pinnedInput').checked = Number(post.sort_order || 0) >= PINNED_SORT;
  $('importantInput').checked = Number(post.sort_order || 0) >= IMPORTANT_SORT || String(post.category || '').toLowerCase() === 'важно';
  setMetadata(post.metadata || {});
  updateSectionFields();
  currentFiles = Array.isArray(post.files) ? [...post.files] : [];
  formTitle.textContent = 'Редактирование записи';
  formModeBadge.textContent = 'редактирование';
  formModeBadge.className = 'status published';
  saveBtn.textContent = 'Сохранить изменения';
  updateCategorySuggestions();
  renderExistingFiles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function duplicatePost(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  $('postId').value = '';
  $('sectionInput').value = post.section;
  $('statusInput').value = 'draft';
  $('titleInput').value = `${post.title || ''} — копия`;
  $('categoryInput').value = post.category || '';
  setEditorHtml(post.content || '');
  $('sortInput').value = '0';
  $('publishedAtInput').value = toLocalInputValue(new Date());
  $('pinnedInput').checked = false;
  $('importantInput').checked = false;
  setMetadata(post.metadata || {});
  updateSectionFields();
  currentFiles = Array.isArray(post.files) ? [...post.files] : [];
  formTitle.textContent = 'Копия записи';
  formModeBadge.textContent = 'копия';
  formModeBadge.className = 'status draft';
  saveBtn.textContent = 'Создать копию';
  updateCategorySuggestions();
  renderExistingFiles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleStatus(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  const nextStatus = post.status === 'published' ? 'draft' : 'published';
  const { error } = await supabase.from('site_posts').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    alert(`Ошибка смены статуса: ${error.message}`);
    return;
  }
  await logActivity('status', post, { status: nextStatus });
  await loadPosts();
  await loadActivityLogs();
}

async function deletePost(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  if (!confirm(`Удалить запись «${post.title}» и все её файлы из Storage?`)) return;

  try {
    await removeStorageFiles(Array.isArray(post.files) ? post.files : []);
    const { error } = await supabase.from('site_posts').delete().eq('id', id);
    if (error) throw error;
    await logActivity('delete', post, { files_count: Array.isArray(post.files) ? post.files.length : 0 });
    await loadPosts();
    await loadActivityLogs();
  } catch (err) {
    alert(`Ошибка удаления: ${err.message}`);
  }
}

function previewForm() {
  const tempFiles = [...currentFiles, ...Array.from($('filesInput').files || []).map((file) => ({ name: file.name, type: file.type, size: file.size, url: '' }))];
  const payload = getPayload(tempFiles);
  if (!payload.title) {
    showNotice(formNotice, 'Для предпросмотра нужен хотя бы заголовок.', 'err');
    return;
  }
  const date = formatDate(payload.published_at);
  previewContent.innerHTML = `
    <article class="detail-card preview-only">
      <div class="post-meta">
        ${payload.category ? `<span>${escapeHTML(payload.category)}</span>` : ''}
        ${date ? `<span>${date}</span>` : ''}
        <span>${escapeHTML(SECTIONS[payload.section] || payload.section)}</span>
      </div>
      <h1>${escapeHTML(payload.title)}</h1>
      ${payload.content ? `<div class="detail-content">${sanitizeHtml(payload.content)}</div>` : '<p class="section-subtitle">Текст не заполнен.</p>'}
      ${tempFiles.length ? `<div class="file-list">${tempFiles.map((file) => `<div class="file-btn"><span>${fileIcon(file.name)} ${escapeHTML(file.name)}</span>${file.size ? `<small>${readableSize(file.size)}</small>` : ''}</div>`).join('')}</div>` : ''}
    </article>
  `;
  previewDialog.showModal();
}

previewBtn?.addEventListener('click', previewForm);
closePreviewBtn?.addEventListener('click', () => previewDialog.close());
previewDialog?.addEventListener('click', (event) => {
  if (event.target === previewDialog) previewDialog.close();
});

$('sectionInput')?.addEventListener('change', () => { updateCategorySuggestions(); updateSectionFields(); });
$('pinnedInput')?.addEventListener('change', () => {
  if ($('pinnedInput').checked) {
    $('importantInput').checked = true;
    if (Number($('sortInput').value || 0) < PINNED_SORT) $('sortInput').value = String(PINNED_SORT);
  }
});
$('importantInput')?.addEventListener('change', () => {
  if ($('importantInput').checked && Number($('sortInput').value || 0) < IMPORTANT_SORT) $('sortInput').value = String(IMPORTANT_SORT);
  if (!$('importantInput').checked && !$('pinnedInput').checked && Number($('sortInput').value || 0) >= IMPORTANT_SORT) $('sortInput').value = '0';
});

filterSection?.addEventListener('change', renderPosts);
filterStatus?.addEventListener('change', renderPosts);
filterCategory?.addEventListener('change', renderPosts);
searchInput?.addEventListener('input', renderPosts);

$('publishedAtInput').value = toLocalInputValue(new Date());
setupRichEditor();
setEditorHtml('');
updateSectionFields();
updateAuthState();
