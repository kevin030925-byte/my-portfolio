const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Ignore storage quota or private mode errors
  }
};

/* ---------- Lazy PDF.js Loader ---------- */
let pdfjsLibPromise = null;
async function ensurePdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(PDFJS_URL)
      .then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return mod;
      })
      .catch((err) => {
        pdfjsLibPromise = null;
        throw err;
      });
  }
  return pdfjsLibPromise;
}

/* ---------- Safe URL & Data Validation ---------- */
function isSafeUrl(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) return false;
  // Allow clean relative paths (e.g., media/pdf/doc.pdf, ./media/video/v.mp4)
  if (trimmed.startsWith('./') || trimmed.startsWith('/') || !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return !trimmed.toLowerCase().startsWith('javascript:') && !trimmed.toLowerCase().startsWith('data:');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isDirectMp4(url, item) {
  if (item && String(item.format || '').toLowerCase() === 'mp4') return true;
  const clean = String(url).split(/[?#]/)[0].toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.m4v');
}

function getOfficialEmbedUrl(rawUrl, explicitEmbed) {
  if (explicitEmbed && isSafeUrl(explicitEmbed)) {
    try {
      const u = new URL(explicitEmbed, window.location.href);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
    } catch {
      return null;
    }
  }
  try {
    const u = new URL(rawUrl, window.location.href);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    // YouTube watch / short / live links -> official privacy-enhanced embed
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const vid = u.searchParams.get('v');
        if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
          return `https://www.youtube-nocookie.com/embed/${vid}`;
        }
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed') && /^[a-zA-Z0-9_-]{6,20}$/.test(parts[1] || '')) {
        return `https://www.youtube-nocookie.com/embed/${parts[1]}`;
      }
    }
    if (host === 'youtu.be') {
      const vid = u.pathname.split('/').filter(Boolean)[0];
      if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
        return `https://www.youtube-nocookie.com/embed/${vid}`;
      }
    }
    if (host === 'vimeo.com') {
      const vid = u.pathname.split('/').filter(Boolean)[0];
      if (vid && /^\d+$/.test(vid)) {
        return `https://player.vimeo.com/video/${vid}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, actionLabel, action, ms = 5000) {
  $('toastMsg').textContent = msg;
  const btn = $('toastAction');
  btn.hidden = !actionLabel;
  btn.textContent = actionLabel || '';
  btn.onclick = () => {
    $('toast').classList.remove('show');
    action?.();
  };
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

/* ---------- Navigation & Contact ---------- */
const menuToggle = $('menuToggle');
const siteNav = $('siteNav');

menuToggle.addEventListener('click', () => {
  const open = !siteNav.classList.contains('open');
  siteNav.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
});

siteNav.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  const navFilter = link.dataset.navFilter;
  if (navFilter) {
    setArchiveFilter(navFilter);
  }
  if (siteNav.classList.contains('open')) {
    siteNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

$('copyEmailBtn').addEventListener('click', async () => {
  const email = 'iseungmini80@gmail.com';
  try {
    await navigator.clipboard.writeText(email);
    toast('이메일 주소를 복사했어요.');
  } catch {
    toast(`이메일: ${email}`);
  }
});

/* ---------- Archive (content.json) ---------- */
const archiveGrid = $('archiveGrid');
const archiveEmpty = $('archiveEmpty');
const archiveBanner = $('archiveBanner');
const archiveCount = $('archiveCount');
const archiveSearch = $('archiveSearch');
const filterBtns = [...document.querySelectorAll('.filter-btn')];

let archiveItems = [];
let activeFilter = 'all';
let searchQuery = '';

function showArchiveBanner(msg, type = 'info') {
  archiveBanner.textContent = msg;
  archiveBanner.className = `archive-banner is-${type}`;
  archiveBanner.hidden = false;
}

function hideArchiveBanner() {
  archiveBanner.hidden = true;
  archiveBanner.textContent = '';
}

function setArchiveFilter(nextFilter) {
  activeFilter = ['all', 'pdf', 'video'].includes(nextFilter) ? nextFilter : 'all';
  filterBtns.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === activeFilter));
  });
  renderArchive();
}

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => setArchiveFilter(btn.dataset.filter));
});

archiveSearch.addEventListener('input', () => {
  searchQuery = archiveSearch.value.trim().toLowerCase();
  renderArchive();
});

function validateArchiveData(raw) {
  if (!Array.isArray(raw)) {
    throw new Error('INVALID_ARRAY');
  }
  const seenIds = new Set();
  const valid = [];
  let skipped = 0;

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      skipped++;
      continue;
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const type = typeof entry.type === 'string' ? entry.type.trim().toLowerCase() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';

    if (!id || !title || !url || (type !== 'pdf' && type !== 'video') || !isSafeUrl(url) || seenIds.has(id)) {
      skipped++;
      continue;
    }

    seenIds.add(id);
    valid.push({
      id,
      type,
      title,
      url,
      category: typeof entry.category === 'string' ? entry.category.trim() : '',
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      date: typeof entry.date === 'string' ? entry.date.trim() : '',
      embedUrl: typeof entry.embedUrl === 'string' ? entry.embedUrl.trim() : '',
      poster: typeof entry.poster === 'string' && isSafeUrl(entry.poster.trim()) ? entry.poster.trim() : '',
      format: typeof entry.format === 'string' ? entry.format.trim() : ''
    });
  }

  return { valid, skipped };
}

function createVideoBlock(item) {
  const wrapper = document.createElement('div');

  if (isDirectMp4(item.url, item)) {
    const stage = document.createElement('div');
    stage.className = 'video-stage';

    const video = document.createElement('video');
    video.className = 'card-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (item.poster) video.poster = item.poster;
    video.src = item.url;
    video.setAttribute('aria-label', `${item.title} 동영상 플레이어`);

    const errBox = document.createElement('div');
    errBox.className = 'video-error-box';
    errBox.hidden = true;
    errBox.textContent = '동영상을 불러오거나 재생할 수 없습니다. 파일 경로 또는 코덱을 확인해 주세요.';

    video.addEventListener('error', () => {
      stage.hidden = true;
      errBox.hidden = false;
    });

    stage.appendChild(video);
    wrapper.append(stage, errBox);
    return wrapper;
  }

  const embedSrc = getOfficialEmbedUrl(item.url, item.embedUrl);
  if (embedSrc) {
    const stage = document.createElement('div');
    stage.className = 'video-stage';

    const iframe = document.createElement('iframe');
    iframe.className = 'card-iframe';
    iframe.src = embedSrc;
    iframe.title = item.title;
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

    stage.appendChild(iframe);
    wrapper.appendChild(stage);
    return wrapper;
  }

  const note = document.createElement('div');
  note.className = 'video-fallback-note';
  note.textContent = '외부 동영상 플랫폼 링크입니다. 아래 버튼으로 원본 시청 페이지를 열 수 있습니다.';
  wrapper.appendChild(note);
  return wrapper;
}

function createMediaCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';

  const top = document.createElement('div');
  top.className = 'card-top';

  const badgeRow = document.createElement('div');
  badgeRow.className = 'badge-row';

  const typeBadge = document.createElement('span');
  typeBadge.className = `type-badge ${item.type === 'pdf' ? 'is-pdf' : 'is-video'}`;
  typeBadge.textContent = item.type === 'pdf' ? 'PDF' : '동영상';
  badgeRow.appendChild(typeBadge);

  if (item.category) {
    const catBadge = document.createElement('span');
    catBadge.className = 'cat-badge';
    catBadge.textContent = item.category;
    badgeRow.appendChild(catBadge);
  }

  top.appendChild(badgeRow);

  if (item.date) {
    const dateEl = document.createElement('time');
    dateEl.className = 'card-date';
    dateEl.dateTime = item.date;
    dateEl.textContent = item.date;
    top.appendChild(dateEl);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = item.title;

  const descEl = document.createElement('p');
  descEl.className = 'card-desc';
  descEl.textContent = item.description || (item.type === 'pdf' ? 'PDF 보고서 자료입니다.' : '영상 자료입니다.');

  card.append(top, titleEl, descEl);

  if (item.type === 'video') {
    card.appendChild(createVideoBlock(item));
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (item.type === 'pdf') {
    const readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'btn btn-primary';
    readBtn.textContent = '책처럼 읽기';
    readBtn.addEventListener('click', () => openPublishedPdf(item, readBtn));

    const extLink = document.createElement('a');
    extLink.className = 'btn btn-secondary';
    extLink.href = item.url;
    extLink.target = '_blank';
    extLink.rel = 'noopener noreferrer';
    extLink.textContent = 'PDF 원본 열기';

    actions.append(readBtn, extLink);
  } else {
    const extLink = document.createElement('a');
    extLink.className = 'btn btn-secondary';
    extLink.href = item.url;
    extLink.target = '_blank';
    extLink.rel = 'noopener noreferrer';
    extLink.textContent = isDirectMp4(item.url, item) ? '영상 원본 열기' : '새 탭에서 영상 열기';

    actions.appendChild(extLink);
  }

  card.appendChild(actions);
  return card;
}

function renderArchive() {
  const filtered = archiveItems.filter((item) => {
    if (activeFilter !== 'all' && item.type !== activeFilter) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  archiveCount.textContent = `총 ${filtered.length}건`;
  archiveGrid.replaceChildren();

  if (!filtered.length) {
    archiveEmpty.hidden = false;
    if (archiveItems.length === 0) {
      $('archiveEmptyTitle').textContent = '등록된 공개 자료가 아직 없습니다';
      $('archiveEmptyDesc').textContent =
        '저장소의 content.json에 PDF 또는 동영상 자료를 등록하면 이 공간에 카드 형태로 표시됩니다. 아래 ‘내 PDF 열기’에서 개인 PDF 파일을 바로 책처럼 읽어볼 수도 있습니다.';
    } else {
      $('archiveEmptyTitle').textContent = '조건에 맞는 자료가 없습니다';
      $('archiveEmptyDesc').textContent = '선택한 유형 필터나 검색어를 조정해 다시 확인해 주세요.';
    }
    return;
  }

  archiveEmpty.hidden = true;
  const frag = document.createDocumentFragment();
  filtered.forEach((item) => frag.appendChild(createMediaCard(item)));
  archiveGrid.appendChild(frag);
}

async function loadArchive() {
  try {
    const res = await fetch('./content.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('INVALID_JSON');
    }
    const { valid, skipped } = validateArchiveData(parsed);
    archiveItems = valid;
    if (skipped > 0) {
      showArchiveBanner(
        `content.json 항목 중 필수 필드(id, type, title, url)가 누락되었거나 id가 중복된 ${skipped}건은 안전하게 제외했습니다.`,
        'info'
      );
    } else {
      hideArchiveBanner();
    }
    renderArchive();
  } catch (err) {
    archiveItems = [];
    renderArchive();
    if (window.location.protocol === 'file:') {
      showArchiveBanner(
        '현재 file:// 경로로 직접 열려 있어 브라우저 보안 정책상 content.json을 자동으로 읽지 못할 수 있습니다. 로컬 HTTP 서버(예: VS Code Live Server, python -m http.server)나 Netlify 배포 주소에서 확인해 주세요. ‘내 PDF 열기’ 기능은 지금도 바로 사용할 수 있습니다.',
        'info'
      );
    } else if (err.message === 'INVALID_JSON' || err.message === 'INVALID_ARRAY') {
      showArchiveBanner('content.json 형식이 올바르지 않습니다. 유효한 JSON 배열인지 확인해 주세요.', 'error');
    } else if (err.message.startsWith('HTTP_')) {
      showArchiveBanner(`자료 목록(content.json)을 불러오지 못했습니다 (${err.message.replace('_', ' ')}).`, 'error');
    } else {
      showArchiveBanner('자료 목록(content.json)을 불러오는 중 네트워크 오류가 발생했습니다.', 'error');
    }
  }
}

/* =========================================================
   Paper — PDF Book Reader (Common Engine for Published & Local)
   ========================================================= */
const readerSection = $('readerSection');
const readerView = $('readerView');
const readerLayout = $('readerLayout');
const readerControls = $('readerControls');
const readerStatusBox = $('readerStatusBox');
const readerStatusMsg = $('readerStatusMsg');
const readerStatusActions = $('readerStatusActions');
const readerExternalLink = $('readerExternalLink');
const fileInput = $('fileInput');
const dropzone = $('dropzone');
const uploadMessage = $('uploadMessage');
const loading = $('loading');
const stage = $('bookStage');
const bookWrap = $('bookWrap');

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;
const STEP = 0.25;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2;

let pageFlip = null;
let bookEl = null;
let currentPdf = null;
let currentSource = null;
let pageCount = 0;
let zoom = 1;
let tx = 0;
let ty = 0;
let docGen = 0;
let dispW = 0;
let dispH = 0;
let baseScale = 1;
const pageCanvases = [];
const renderedQ = [];
const renderTasks = new Map();
let ensureToken = 0;
let rerenderTimer = null;
let badgeTimer = null;
let store = { bookmarks: [], last: 0 };
let storeKey = '';
let lastTriggerEl = null;

/* ---------- Reader Theme (light / dark / sepia) ---------- */
const THEMES = ['light', 'dark', 'sepia'];
function applyReaderTheme(t) {
  if (!THEMES.includes(t)) t = 'light';
  readerView.dataset.readerTheme = t;
  document.querySelectorAll('#themeSeg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.themeSet === t);
  });
  lsSet('paper:theme', t);
}
applyReaderTheme(lsGet('paper:theme') || 'light');

$('themeBtn').addEventListener('click', () => {
  const cur = readerView.dataset.readerTheme || 'light';
  applyReaderTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
});
$('themeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) applyReaderTheme(b.dataset.themeSet);
});

/* ---------- Reader Show / Close / Back History ---------- */
function setReaderStatus(msg, { isError = false, fallbackUrl = '' } = {}) {
  readerStatusMsg.textContent = msg;
  readerStatusBox.className = `reader-status-box${isError ? ' is-error' : ''}`;
  readerStatusActions.replaceChildren();

  if (fallbackUrl && isSafeUrl(fallbackUrl)) {
    const extBtn = document.createElement('a');
    extBtn.className = 'btn btn-primary';
    extBtn.href = fallbackUrl;
    extBtn.target = '_blank';
    extBtn.rel = 'noopener noreferrer';
    extBtn.textContent = 'PDF 원본 열기';
    readerStatusActions.appendChild(extBtn);
  }

  if (isError) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = '목록으로 닫기';
    closeBtn.addEventListener('click', () => requestCloseReader());
    readerStatusActions.appendChild(closeBtn);
  }

  readerStatusBox.hidden = false;
  readerLayout.hidden = true;
  readerControls.hidden = true;
}

function clearReaderStatus() {
  readerStatusBox.hidden = true;
  readerStatusMsg.textContent = '';
  readerStatusActions.replaceChildren();
  readerLayout.hidden = false;
  readerControls.hidden = false;
}

function pushReaderHistory() {
  if (!history.state?.paperReader) {
    try {
      history.pushState({ paperReader: true }, '', '#reader');
    } catch {
      // Ignore pushState restrictions on some file:// contexts
    }
  }
}

function showReaderShell(triggerEl) {
  lastTriggerEl = triggerEl || document.activeElement;
  readerSection.hidden = false;
  pushReaderHistory();
  readerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cleanupReaderResources() {
  docGen++;
  ensureToken++;
  searchToken++;
  renderTasks.forEach((t) => {
    try {
      t.cancel();
    } catch {}
  });
  renderTasks.clear();
  if (thumbObserver) {
    thumbObserver.disconnect();
    thumbObserver = null;
  }
  if (pageFlip) {
    try {
      pageFlip.destroy();
    } catch {}
    pageFlip = null;
  }
  if (currentPdf) {
    try {
      currentPdf.destroy();
    } catch {}
    currentPdf = null;
  }
  currentSource = null;
  bookWrap.replaceChildren();
  bookEl = null;
  pageCanvases.length = 0;
  renderedQ.length = 0;
}

function closeReader({ restoreFocus = true } = {}) {
  if (document.fullscreenElement === readerView) {
    document.exitFullscreen?.().catch(() => {});
  }
  cleanupReaderResources();
  clearReaderStatus();
  readerSection.hidden = true;
  readerExternalLink.hidden = true;
  if (restoreFocus && lastTriggerEl && typeof lastTriggerEl.focus === 'function' && document.contains(lastTriggerEl)) {
    lastTriggerEl.focus({ preventScroll: true });
  }
  lastTriggerEl = null;
}

function requestCloseReader() {
  if (history.state?.paperReader) {
    history.back();
  } else {
    closeReader();
  }
}

$('closeReaderBtn').addEventListener('click', requestCloseReader);

window.addEventListener('popstate', () => {
  if (!readerSection.hidden && !history.state?.paperReader) {
    closeReader();
  }
});

/* ---------- Local File Handling ---------- */
$('chooseFile').addEventListener('click', () => fileInput.click());
$('newFileBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  if (e.target.files?.length) await handleFiles([...e.target.files]);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);
dropzone.addEventListener('drop', async (e) => {
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) await handleFiles(files);
});

async function handleFiles(files) {
  uploadMessage.textContent = '';
  if (files.length > MAX_FILES) {
    uploadMessage.textContent = '한 번에 최대 5개 파일까지 선택할 수 있습니다.';
    return;
  }
  const invalid = files.find((f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'));
  if (invalid) {
    uploadMessage.textContent = 'PDF 파일만 열 수 있습니다.';
    return;
  }
  const tooLarge = files.find((f) => f.size > MAX_SIZE);
  if (tooLarge) {
    uploadMessage.textContent = `${tooLarge.name}: 파일 크기는 20MB 이하여야 합니다.`;
    return;
  }

  // The reader opens one document at a time; selecting multiple files is validated and the first is opened.
  const file = files[0];
  loading.classList.add('show');
  $('chooseFile').disabled = true;

  try {
    if (!window.St?.PageFlip) {
      throw new Error('PAGEFLIP_MISSING');
    }
    const pdfjsLib = await ensurePdfJs();
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    showReaderShell($('chooseFile'));
    await openDocument(pdf, {
      kind: 'local',
      storeKey: `paper:v1:${file.name}:${file.size}`,
      title: file.name,
      category: '로컬 PDF',
      url: null
    });
  } catch (err) {
    console.error(err);
    if (!pageFlip) closeReader({ restoreFocus: false });
    uploadMessage.textContent = 'PDF를 열 수 없습니다. 파일이 손상되지 않았는지 또는 네트워크 연결을 확인해 주세요.';
    if (!readerSection.hidden) toast('PDF를 열 수 없습니다. 파일을 확인해 주세요.');
  } finally {
    loading.classList.remove('show');
    $('chooseFile').disabled = false;
  }
}

/* ---------- Published PDF Opening ---------- */
async function openPublishedPdf(item, triggerEl) {
  cleanupReaderResources();
  const gen = ++docGen;

  showReaderShell(triggerEl);
  $('bookName').textContent = item.title;
  $('bookInfo').textContent = `${item.category ? item.category + ' · ' : ''}PDF 불러오는 중…`;
  readerExternalLink.href = item.url;
  readerExternalLink.hidden = false;
  setReaderStatus('PDF 문서를 책 뷰어로 불러오고 있습니다…');

  try {
    const pdfjsLib = await ensurePdfJs();
    if (gen !== docGen) return;

    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
    const bytes = await res.arrayBuffer();
    if (gen !== docGen) return;

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    if (gen !== docGen) {
      try {
        pdf.destroy();
      } catch {}
      return;
    }

    await openDocument(
      pdf,
      {
        kind: 'published',
        storeKey: `paper:v1:pub:${item.id}`,
        title: item.title,
        category: item.category || 'PDF 보고서',
        url: item.url
      },
      gen
    );
  } catch (err) {
    if (gen !== docGen) return;
    console.error(err);
    let msg = 'PDF 문서를 불러오지 못했습니다. 아래 ‘PDF 원본 열기’ 링크로 문서를 직접 확인해 주세요.';
    if (err.message?.startsWith('HTTP_')) {
      msg = `PDF 파일을 찾을 수 없거나 서버 응답 오류가 발생했습니다 (${err.message.replace('_', ' ')}). 아래 ‘PDF 원본 열기’ 링크를 확인해 주세요.`;
    } else if (err.name === 'TypeError') {
      msg = '외부 서버의 CORS 정책 또는 네트워크 제한으로 책 뷰어에서 직접 열지 못했습니다. 아래 ‘PDF 원본 열기’ 링크를 이용해 주세요.';
    }
    $('bookInfo').textContent = '불러오기 실패';
    setReaderStatus(msg, { isError: true, fallbackUrl: item.url });
  }
}

/* ---------- Saved State (Bookmarks / Last Page) ---------- */
function loadStore() {
  store = { bookmarks: [], last: 0 };
  try {
    const raw = lsGet(storeKey);
    if (raw) {
      const o = JSON.parse(raw);
      if (Array.isArray(o.bookmarks)) {
        store.bookmarks = o.bookmarks
          .filter((b) => Number.isInteger(b?.page) && b.page >= 1)
          .map((b) => ({ page: b.page, note: String(b.note || '').slice(0, 60) }));
      }
      if (Number.isInteger(o.last)) store.last = o.last;
    }
  } catch {}
}
const saveStore = () => lsSet(storeKey, JSON.stringify(store));

/* ---------- Open Document (Unified Local & Published Flow) ---------- */
async function openDocument(pdf, source, existingGen) {
  if (!window.St?.PageFlip) {
    throw new Error('PAGEFLIP_MISSING');
  }

  const gen = existingGen ?? ++docGen;
  renderTasks.forEach((t) => {
    try {
      t.cancel();
    } catch {}
  });
  renderTasks.clear();

  const old = currentPdf;
  currentPdf = pdf;
  currentSource = source;
  pageCount = pdf.numPages;
  if (old && old !== pdf) {
    try {
      old.destroy();
    } catch {}
  }

  zoom = 1;
  tx = 0;
  ty = 0;
  pageTexts = null;
  textBuilding = null;
  searchToken++;
  $('searchResults').replaceChildren();
  $('searchStatus').textContent = '';
  $('searchInput').value = '';

  storeKey = source.storeKey;
  loadStore();
  const startIdx = store.last >= 1 && store.last <= pageCount ? store.last - 1 : 0;

  if (pageFlip) {
    try {
      pageFlip.destroy();
    } catch {}
    pageFlip = null;
  }
  bookWrap.replaceChildren();
  bookEl = document.createElement('div');
  bookEl.id = 'book';
  bookWrap.appendChild(bookEl);
  pageCanvases.length = 0;
  renderedQ.length = 0;

  const first = await pdf.getPage(1);
  if (gen !== docGen) return;
  const vp = first.getViewport({ scale: 1 });
  baseScale = Math.min(760 / vp.width, 1000 / vp.height, 1.5);
  dispW = Math.round(vp.width * baseScale);
  dispH = Math.round(vp.height * baseScale);

  for (let n = 1; n <= pageCount; n++) {
    const wrap = document.createElement('div');
    wrap.className = 'page page-shadow';
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(dispW / 4));
    canvas.height = Math.max(2, Math.round(dispH / 4));
    const c = canvas.getContext('2d', { alpha: false });
    c.fillStyle = '#fff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    wrap.appendChild(canvas);
    bookEl.appendChild(wrap);
    pageCanvases[n] = canvas;
    renderedQ[n] = 0;
  }

  await renderPage(startIdx + 1, targetQ(), gen);
  if (gen !== docGen) return;

  clearReaderStatus();
  readerSection.hidden = false;

  if (source.url && isSafeUrl(source.url)) {
    readerExternalLink.href = source.url;
    readerExternalLink.hidden = false;
  } else {
    readerExternalLink.hidden = true;
  }

  $('bookName').textContent = source.title;
  $('bookInfo').textContent = `${source.category} · ${pageCount} pages`;
  $('panelFileName').textContent = source.title;
  $('panelFileName').title = source.title;
  $('panelPages').textContent = pageCount;

  if (window.innerWidth > 760) openPanel(true);
  updateZoomUI();
  applyTransform();

  pageFlip = new window.St.PageFlip(bookEl, {
    width: dispW,
    height: dispH,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 900,
    minHeight: 360,
    maxHeight: 1200,
    drawShadow: true,
    maxShadowOpacity: 0.22,
    flippingTime: 1050,
    usePortrait: true,
    startPage: startIdx,
    showCover: false,
    autoSize: true,
    mobileScrollSupport: false,
    disableFlipByClick: false,
    swipeDistance: 30
  });
  pageFlip.loadFromHTML(bookEl.querySelectorAll('.page'));
  pageFlip.on('flip', (e) => {
    updateControls(e.data);
    ensureRendered();
  });
  pageFlip.on('changeState', (e) => {
    if (e.data === 'read') {
      updateControls(pageFlip.getCurrentPageIndex());
      ensureRendered();
    }
  });

  updateControls(startIdx);
  ensureRendered();
  buildThumbs();
  loadOutline(pdf, gen);
  renderMarks();
  if (startIdx > 0) toast(`${startIdx + 1}쪽에서 이어서 읽어요`, '처음부터', () => goToPage(0));
}

/* ---------- Lazy, Zoom-Aware Rendering ---------- */
function targetQ() {
  const dpr = window.devicePixelRatio || 1;
  const q = Math.max(1.5, zoom * dpr);
  return Math.min(q, Math.sqrt(16e6 / (dispW * dispH)));
}

async function renderPage(n, q, gen) {
  if (!currentPdf || n < 1 || n > pageCount || renderedQ[n] >= q - 0.01) return;
  try {
    const page = await currentPdf.getPage(n);
    if (gen !== docGen) return;
    const vp = page.getViewport({ scale: baseScale * q });
    const off = document.createElement('canvas');
    off.width = Math.ceil(vp.width);
    off.height = Math.ceil(vp.height);
    const task = page.render({ canvasContext: off.getContext('2d', { alpha: false }), viewport: vp });
    renderTasks.set(n, task);
    try {
      await task.promise;
    } finally {
      if (renderTasks.get(n) === task) renderTasks.delete(n);
    }
    if (gen !== docGen || renderedQ[n] >= q - 0.01) return;
    const c = pageCanvases[n];
    c.width = off.width;
    c.height = off.height;
    c.getContext('2d', { alpha: false }).drawImage(off, 0, 0);
    renderedQ[n] = q;
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') console.warn('render failed', n, err);
  }
}

function ensureRendered() {
  if (!currentPdf) return;
  const token = ++ensureToken;
  const gen = docGen;
  const cur = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
  const q = targetQ();
  const farQ = Math.min(q, Math.max(1.5, window.devicePixelRatio || 1));
  const order = [cur + 1];
  for (let d = 1; d <= 3; d++) order.push(cur + 1 + d, cur + 1 - d);
  (async () => {
    for (const n of order) {
      if (token !== ensureToken || gen !== docGen) return;
      await renderPage(n, Math.abs(n - (cur + 1)) <= 1 ? q : farQ, gen);
    }
  })();
}

/* ---------- Reader Controls ---------- */
function currentIndex() {
  return pageFlip ? pageFlip.getCurrentPageIndex() : 0;
}

function updateControls(index) {
  if (!pageFlip) return;
  const current = clamp(index + 1, 1, pageCount);
  if (document.activeElement !== $('pageInput')) $('pageInput').value = current;
  $('pageInput').max = pageCount;
  $('pageTotal').textContent = `/ ${pageCount}`;
  $('progressBar').style.width = `${(current / pageCount) * 100}%`;
  $('prevBtn').disabled = current === 1;
  $('nextBtn').disabled = current === pageCount;
  $('panelCurrent').textContent = current;
  store.last = current;
  saveStore();
  const marked = store.bookmarks.some((b) => b.page === current);
  $('starBtn').classList.toggle('starred', marked);
  $('markAdd').textContent = marked ? '해제' : '북마크';
  document.querySelectorAll('.thumb').forEach((t) => {
    const on = Number(t.dataset.page) === current;
    t.classList.toggle('current', on);
    if (on && $('pane-thumbs').classList.contains('active')) t.scrollIntoView({ block: 'nearest' });
  });
}

function goToPage(idx) {
  if (!pageFlip) return;
  idx = clamp(Math.round(idx), 0, pageCount - 1);
  pageFlip.turnToPage(idx);
  updateControls(pageFlip.getCurrentPageIndex());
  ensureRendered();
}

$('prevBtn').addEventListener('click', () => pageFlip?.flipPrev());
$('nextBtn').addEventListener('click', () => pageFlip?.flipNext());
$('pageInput').addEventListener('focus', (e) => e.target.select());
$('pageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = parseInt(e.target.value, 10);
    if (Number.isFinite(v)) goToPage(v - 1);
    e.target.blur();
  }
  if (e.key === 'Escape') e.target.blur();
  e.stopPropagation();
});
$('pageInput').addEventListener('blur', () => updateControls(currentIndex()));

/* ---------- Zoom / Pan ---------- */
function clampPan() {
  if (zoom <= 1) {
    tx = 0;
    ty = 0;
    return;
  }
  const bw = bookEl?.offsetWidth || bookWrap.offsetWidth;
  const bh = bookEl?.offsetHeight || bookWrap.offsetHeight;
  const maxX = Math.max(0, (bw * zoom - stage.clientWidth) / 2) + 40;
  const maxY = Math.max(0, (bh * zoom - stage.clientHeight) / 2) + 40;
  tx = clamp(tx, -maxX, maxX);
  ty = clamp(ty, -maxY, maxY);
}

function applyTransform() {
  bookWrap.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
}

function updateZoomUI() {
  const pct = `${Math.round(zoom * 100)}%`;
  $('zoomLabel').textContent = pct;
  $('panelZoom').textContent = pct;
  $('zoomBadge').textContent = pct;
  $('zoomOut').disabled = zoom <= MIN_ZOOM + 1e-6;
  $('zoomIn').disabled = zoom >= MAX_ZOOM - 1e-6;
  stage.classList.toggle('zoomed', zoom > 1);
}

function setZoom(value, cx, cy) {
  const z = clamp(Math.round(value / STEP) * STEP, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(z - zoom) < 1e-6) return;
  const r = stage.getBoundingClientRect();
  const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2);
  const py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
  tx = px - ((px - tx) * z) / zoom;
  ty = py - ((py - ty) * z) / zoom;
  zoom = z;
  clampPan();
  applyTransform();
  updateZoomUI();
  $('zoomBadge').classList.add('show');
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => $('zoomBadge').classList.remove('show'), 900);
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(ensureRendered, 180);
}

$('zoomIn').addEventListener('click', () => setZoom(zoom + STEP));
$('zoomOut').addEventListener('click', () => setZoom(zoom - STEP));
$('zoomLabel').addEventListener('click', () => setZoom(1));

let wheelAcc = 0;
let wheelTimer = null;
stage.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      wheelAcc += e.deltaY;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => (wheelAcc = 0), 250);
      if (Math.abs(wheelAcc) >= 40) {
        setZoom(zoom + (wheelAcc < 0 ? STEP : -STEP), e.clientX, e.clientY);
        wheelAcc = 0;
      }
    } else if (zoom > 1) {
      e.preventDefault();
      if (e.shiftKey && !e.deltaX) tx -= e.deltaY;
      else {
        tx -= e.deltaX;
        ty -= e.deltaY;
      }
      clampPan();
      applyTransform();
    }
  },
  { passive: false }
);

let drag = null;
stage.addEventListener('pointerdown', (e) => {
  if (zoom <= 1 || e.button !== 0) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx, ty };
  stage.setPointerCapture(e.pointerId);
  stage.classList.add('dragging');
});
stage.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  tx = drag.tx + (e.clientX - drag.x);
  ty = drag.ty + (e.clientY - drag.y);
  clampPan();
  applyTransform();
});
const endDrag = (e) => {
  if (drag && e.pointerId === drag.id) {
    drag = null;
    stage.classList.remove('dragging');
  }
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', () => {
  clampPan();
  applyTransform();
});

/* ---------- Side Panel & Tabs ---------- */
function openPanel(open) {
  readerLayout.classList.toggle('panel-open', open);
  $('panelToggle').classList.toggle('active', open);
  $('panelToggle').setAttribute('aria-expanded', String(open));
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
}
$('panelToggle').addEventListener('click', () => openPanel(!readerLayout.classList.contains('panel-open')));

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${name}`));
  $('tabBody').scrollTop = 0;
  if (name === 'thumbs') document.querySelector('.thumb.current')?.scrollIntoView({ block: 'center' });
  if (name === 'search') setTimeout(() => $('searchInput').focus(), 0);
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) showTab(t.dataset.tab);
});

$('fullscreenBtn').addEventListener('click', async () => {
  if (!document.fullscreenElement) await readerView.requestFullscreen?.();
  else await document.exitFullscreen?.();
});

/* ---------- Outline (목차) ---------- */
async function resolveDestPage(dest) {
  let d = dest;
  if (typeof d === 'string') d = await currentPdf.getDestination(d);
  if (!Array.isArray(d)) return null;
  const ref = d[0];
  if (ref && typeof ref === 'object') return await currentPdf.getPageIndex(ref);
  return Number.isInteger(ref) ? ref : null;
}

async function loadOutline(pdf, gen) {
  const list = $('outlineList');
  list.replaceChildren();
  let outline = null;
  try {
    outline = await pdf.getOutline();
  } catch {}
  if (gen !== docGen) return;
  if (!outline || !outline.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = '이 PDF에는 목차 정보가 없습니다. 썸네일이나 검색 탭을 이용해 보세요.';
    list.appendChild(d);
    return;
  }
  const walk = (items, depth) =>
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'outline-item';
      b.textContent = it.title || '(제목 없음)';
      b.style.paddingLeft = `${6 + depth * 14}px`;
      if (it.dest) {
        b.addEventListener('click', async () => {
          try {
            const i = await resolveDestPage(it.dest);
            if (i !== null) goToPage(i);
          } catch (e) {
            console.warn(e);
          }
        });
      } else {
        b.disabled = true;
      }
      list.appendChild(b);
      if (it.items?.length) walk(it.items, depth + 1);
    });
  walk(outline, 0);
}

/* ---------- Thumbnails ---------- */
let thumbObserver = null;
let thumbQueue = [];
let thumbBusy = false;

function buildThumbs() {
  const list = $('thumbList');
  list.replaceChildren();
  thumbQueue = [];
  thumbObserver?.disconnect();
  thumbObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        thumbObserver.unobserve(en.target);
        thumbQueue.push(Number(en.target.dataset.page));
        pumpThumbs();
      });
    },
    { root: $('tabBody'), rootMargin: '300px' }
  );
  for (let n = 1; n <= pageCount; n++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.dataset.page = n;
    b.setAttribute('aria-label', `${n}쪽으로 이동`);
    const c = document.createElement('canvas');
    c.width = 110;
    c.height = Math.round((110 * dispH) / dispW);
    const s = document.createElement('span');
    s.textContent = n;
    b.append(c, s);
    b.addEventListener('click', () => goToPage(n - 1));
    list.appendChild(b);
    thumbObserver.observe(b);
  }
}

async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  const gen = docGen;
  while (thumbQueue.length && gen === docGen) {
    const n = thumbQueue.shift();
    try {
      const page = await currentPdf.getPage(n);
      if (gen !== docGen) break;
      const w = page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale: (130 * Math.min(window.devicePixelRatio || 1, 2)) / w });
      const c = document.querySelector(`.thumb[data-page="${n}"] canvas`);
      if (!c) continue;
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      await page.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.warn('thumb failed', n, err);
    }
  }
  thumbBusy = false;
  if (thumbQueue.length) pumpThumbs();
}

/* ---------- Full-Text Search ---------- */
let pageTexts = null;
let textBuilding = null;
let searchToken = 0;
let textProgressCb = null;

function buildTextIndex(onProgress) {
  textProgressCb = onProgress;
  if (pageTexts) return Promise.resolve(pageTexts);
  if (textBuilding) return textBuilding;
  const gen = docGen;
  const pdf = currentPdf;
  textBuilding = (async () => {
    const arr = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (gen !== docGen) return null;
      try {
        const page = await pdf.getPage(n);
        const tc = await page.getTextContent();
        arr.push(tc.items.map((i) => (i.str || '') + (i.hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' '));
      } catch {
        arr.push('');
      }
      if (n % 5 === 0 || n === pdf.numPages) textProgressCb?.(n);
    }
    if (gen === docGen) pageTexts = arr;
    return arr;
  })();
  return textBuilding;
}

async function runSearch() {
  const q = $('searchInput').value.trim();
  if (!q || !currentPdf) return;
  const gen = docGen;
  const token = ++searchToken;
  const status = $('searchStatus');
  const box = $('searchResults');
  box.replaceChildren();
  status.textContent = '검색 준비 중…';
  const texts = await buildTextIndex((p) => {
    if (token === searchToken) status.textContent = `검색 준비 중… ${p}/${pageCount}`;
  });
  if (!texts || gen !== docGen || token !== searchToken) return;
  if (texts.every((t) => !t.trim())) {
    status.textContent = '텍스트가 없는 PDF(스캔본 등)는 검색할 수 없습니다.';
    return;
  }
  const needle = q.toLowerCase();
  let total = 0;
  let pages = 0;
  const frag = document.createDocumentFragment();
  texts.forEach((t, i) => {
    const low = t.toLowerCase();
    const pos = low.indexOf(needle);
    if (pos < 0) return;
    let c = 0;
    for (let p = pos; p >= 0; p = low.indexOf(needle, p + needle.length)) c++;
    total += c;
    pages++;
    const s = Math.max(0, pos - 24);
    const e = Math.min(t.length, pos + needle.length + 44);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'result';
    const head = document.createElement('b');
    head.textContent = `${i + 1}쪽`;
    const em = document.createElement('em');
    em.textContent = `${c}건`;
    head.appendChild(em);
    const sn = document.createElement('span');
    const mk = document.createElement('mark');
    mk.textContent = t.slice(pos, pos + needle.length);
    sn.append((s > 0 ? '…' : '') + t.slice(s, pos), mk, t.slice(pos + needle.length, e) + (e < t.length ? '…' : ''));
    btn.append(head, sn);
    btn.addEventListener('click', () => goToPage(i));
    frag.appendChild(btn);
  });
  status.textContent = pages ? `${pages}개 페이지에서 ${total}건` : `“${q}” 검색 결과가 없습니다.`;
  box.appendChild(frag);
}
$('searchBtn').addEventListener('click', runSearch);
$('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
  e.stopPropagation();
});

/* ---------- Bookmarks ---------- */
function renderMarks() {
  const list = $('markList');
  list.replaceChildren();
  const items = [...store.bookmarks].sort((a, b) => a.page - b.page);
  $('markStatus').textContent = items.length ? `북마크 ${items.length}개` : '';
  if (!items.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = '아직 북마크가 없습니다. 상단 아이콘이나 B 키로 현재 페이지를 저장해 보세요.';
    list.appendChild(d);
    return;
  }
  items.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'mark-item';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'go';
    const b = document.createElement('b');
    b.textContent = `${m.page}쪽`;
    go.appendChild(b);
    if (m.note) {
      const s = document.createElement('span');
      s.textContent = m.note;
      go.appendChild(s);
    }
    go.addEventListener('click', () => goToPage(m.page - 1));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '×';
    del.title = '삭제';
    del.setAttribute('aria-label', `${m.page}쪽 북마크 삭제`);
    del.addEventListener('click', () => {
      store.bookmarks = store.bookmarks.filter((x) => x.page !== m.page);
      saveStore();
      renderMarks();
      updateControls(currentIndex());
    });
    row.append(go, del);
    list.appendChild(row);
  });
}

function toggleBookmark(note = '') {
  if (!pageFlip) return;
  const page = currentIndex() + 1;
  const has = store.bookmarks.some((b) => b.page === page);
  if (has) {
    store.bookmarks = store.bookmarks.filter((b) => b.page !== page);
    toast(`${page}쪽 북마크를 해제했어요`);
  } else {
    store.bookmarks.push({ page, note: note.trim().slice(0, 60) });
    toast(`${page}쪽을 북마크했어요`);
  }
  saveStore();
  renderMarks();
  updateControls(page - 1);
}

$('starBtn').addEventListener('click', () => toggleBookmark());
$('markAdd').addEventListener('click', () => {
  toggleBookmark($('markNote').value);
  $('markNote').value = '';
});
$('markNote').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('markAdd').click();
  e.stopPropagation();
});

/* ---------- Keyboard Shortcuts ---------- */
document.addEventListener('keydown', (e) => {
  if (readerSection.hidden) return;
  if (e.key === 'Escape' && !document.fullscreenElement && !e.target.closest?.('input, textarea, select')) {
    e.preventDefault();
    requestCloseReader();
    return;
  }
  if (!pageFlip) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select')) return;
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      pageFlip.flipNext();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      pageFlip.flipPrev();
      break;
    case 'Home':
      e.preventDefault();
      goToPage(0);
      break;
    case 'End':
      e.preventDefault();
      goToPage(pageCount - 1);
      break;
    case '+':
    case '=':
      e.preventDefault();
      setZoom(zoom + STEP);
      break;
    case '-':
    case '_':
      e.preventDefault();
      setZoom(zoom - STEP);
      break;
    case '0':
      e.preventDefault();
      setZoom(1);
      break;
    case 'b':
    case 'B':
      e.preventDefault();
      toggleBookmark();
      break;
    case '/':
      e.preventDefault();
      openPanel(true);
      showTab('search');
      break;
  }
});

/* ---------- Init ---------- */
loadArchive();
