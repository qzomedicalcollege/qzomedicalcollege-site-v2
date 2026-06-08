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
const formNotice = $('formNotice');
const postsList = $('postsList');
const resetBtn = $('resetBtn');
const saveBtn = $('saveBtn');
const existingFilesBox = $('existingFiles');
const filterSection = $('filterSection');
const searchInput = $('searchInput');

let allPosts = [];
let currentFiles = [];
let currentUser = null;

function showNotice(el, message, type = 'ok') {
  el.className = `notice ${type}`;
  el.textContent = message;
}

function clearNotice(el) {
  el.className = 'notice';
  el.textContent = '';
}

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function toLocalInputValue(dateLike) {
  const date = dateLike ? new Date(dateLike) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function sanitizeFileName(name) {
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

function renderExistingFiles() {
  if (!currentFiles.length) {
    existingFilesBox.innerHTML = '';
    return;
  }
  existingFilesBox.innerHTML = currentFiles.map((file, index) => `
    <button class="file-btn" type="button" data-remove-file="${index}">
      ${fileIcon(file.name)} Удалить из записи: ${escapeHTML(file.name)}
    </button>
  `).join('');
  existingFilesBox.querySelectorAll('[data-remove-file]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.removeFile);
      currentFiles.splice(index, 1);
      renderExistingFiles();
    });
  });
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
  if (isAdmin) await loadPosts();
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
    const firstImage = files.find((file) => file.type?.startsWith('image/'));

    const oldPost = id ? allPosts.find((item) => item.id === id) : null;
    const oldFiles = Array.isArray(oldPost?.files) ? oldPost.files : [];

    const payload = {
      section,
      status: $('statusInput').value,
      title: $('titleInput').value.trim(),
      category: $('categoryInput').value.trim() || null,
      content: $('contentInput').value.trim() || null,
      sort_order: Number($('sortInput').value || 0),
      published_at: $('publishedAtInput').value ? new Date($('publishedAtInput').value).toISOString() : new Date().toISOString(),
      files,
      image_url: firstImage?.url || null,
      updated_at: new Date().toISOString()
    };

    if (!payload.title) throw new Error('Введите заголовок.');

    const result = id
      ? await supabase.from('site_posts').update(payload).eq('id', id)
      : await supabase.from('site_posts').insert(payload);

    if (result.error) throw result.error;

    if (id && oldFiles.length) {
      const newPaths = new Set(files.map((file) => file.path).filter(Boolean));
      const removedFiles = oldFiles.filter((file) => file.path && !newPaths.has(file.path));
      if (removedFiles.length) await removeStorageFiles(removedFiles);
    }

    showNotice(formNotice, id ? 'Запись обновлена.' : 'Запись опубликована.', 'ok');
    resetForm();
    await loadPosts();
  } catch (err) {
    showNotice(formNotice, `Ошибка: ${err.message}`, 'err');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = $('postId').value ? 'Сохранить изменения' : 'Опубликовать';
  }
});

function resetForm() {
  postForm.reset();
  $('postId').value = '';
  $('sortInput').value = '0';
  $('publishedAtInput').value = toLocalInputValue(new Date());
  currentFiles = [];
  formTitle.textContent = 'Новая запись';
  saveBtn.textContent = 'Опубликовать';
  renderExistingFiles();
}

resetBtn?.addEventListener('click', resetForm);

async function loadPosts() {
  postsList.innerHTML = '<div class="empty-state">Загрузка...</div>';
  const { data, error } = await supabase
    .from('site_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    postsList.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHTML(error.message)}</div>`;
    return;
  }

  allPosts = data || [];
  renderPosts();
}

function renderPosts() {
  const section = filterSection.value;
  const search = searchInput.value.trim().toLowerCase();
  const filtered = allPosts.filter((post) => {
    const bySection = !section || post.section === section;
    const bySearch = !search || post.title?.toLowerCase().includes(search) || post.content?.toLowerCase().includes(search);
    return bySection && bySearch;
  });

  if (!filtered.length) {
    postsList.innerHTML = '<div class="empty-state">Записей нет.</div>';
    return;
  }

  postsList.innerHTML = filtered.map((post) => `
    <article class="admin-post" data-id="${escapeHTML(post.id)}">
      <h4>${escapeHTML(post.title)}</h4>
      <small>${escapeHTML(SECTIONS[post.section] || post.section)} · ${post.category ? escapeHTML(post.category) + ' · ' : ''}${new Date(post.created_at).toLocaleDateString('ru-RU')}</small>
      <div style="margin-top: 8px;"><span class="status ${post.status}">${post.status === 'published' ? 'Опубликовано' : 'Черновик'}</span></div>
      <div class="admin-post-actions">
        <button class="btn btn-muted" type="button" data-edit="${escapeHTML(post.id)}">Редактировать</button>
        <button class="btn btn-danger" type="button" data-delete="${escapeHTML(post.id)}">Удалить</button>
      </div>
    </article>
  `).join('');

  postsList.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => editPost(btn.dataset.edit)));
  postsList.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', () => deletePost(btn.dataset.delete)));
}

function editPost(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  $('postId').value = post.id;
  $('sectionInput').value = post.section;
  $('statusInput').value = post.status;
  $('titleInput').value = post.title || '';
  $('categoryInput').value = post.category || '';
  $('contentInput').value = post.content || '';
  $('sortInput').value = post.sort_order || 0;
  $('publishedAtInput').value = toLocalInputValue(post.published_at || post.created_at);
  currentFiles = Array.isArray(post.files) ? [...post.files] : [];
  formTitle.textContent = 'Редактирование записи';
  saveBtn.textContent = 'Сохранить изменения';
  renderExistingFiles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deletePost(id) {
  const post = allPosts.find((item) => item.id === id);
  if (!post) return;
  if (!confirm(`Удалить запись «${post.title}» и все её файлы?`)) return;

  try {
    await removeStorageFiles(Array.isArray(post.files) ? post.files : []);
    const { error } = await supabase.from('site_posts').delete().eq('id', id);
    if (error) throw error;
    await loadPosts();
  } catch (err) {
    alert(`Ошибка удаления: ${err.message}`);
  }
}

filterSection?.addEventListener('change', renderPosts);
searchInput?.addEventListener('input', renderPosts);

$('publishedAtInput').value = toLocalInputValue(new Date());
updateAuthState();
