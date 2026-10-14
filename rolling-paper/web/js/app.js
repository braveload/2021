// 우리 팀 롤링페이퍼 — 화면/동작 (PC·모바일 공용, body[data-mode] 로 레이아웃만 달라짐)
import { CONFIG } from './config.js';
import {
  h, $, $$, randomId, randomCode, seeded, storage, fmtRemain, fmtDateTime, toLocalInput,
  toast, confetti, floatEmoji, qrSvg, compressImage, toCsv, download, copyText,
} from './util.js';

const MODE = document.body.dataset.mode === 'mobile' ? 'mobile' : 'desktop';
const COOLDOWN_MS = 3000;

const THEMES = {
  birthday:   { emoji: '🎂', label: '생일 축하',   title: '○○님 생일 축하해요!',
    prompts: ['올해 ○○님이 제일 빛났던 순간은?', '처음 만났을 때 기억나요? 한 줄만!', '생일 선물 대신 드리는 한마디', '○○님을 한 단어로 표현하면?', '내년엔 이런 일이 있길 바라요', '고마웠던 순간을 콕 집어서!'] },
  farewell:   { emoji: '👋', label: '송별·환영',   title: '○○님, 함께해서 행복했어요',
    prompts: ['같이 일하며 제일 고마웠던 점', '앞으로도 응원하는 이유 한 가지', '우리끼리만 아는 웃음 포인트', '새 출발에 보내는 응원 한 줄', '다음에 만나면 이거 하자!', '제일 기억에 남는 순간은?'] },
  graduation: { emoji: '🎓', label: '수료·졸업',   title: '수료를 축하합니다!',
    prompts: ['이번 과정에서 제일 크게 배운 것', '같이 고생한 동료에게 한마디', '제일 뿌듯했던 순간', '앞으로의 나에게 보내는 다짐', '선생님께 전하고 싶은 말', '다시 돌아간다면 해보고 싶은 것'] },
  feedback:   { emoji: '💬', label: '회의·강의 피드백', title: '오늘 어땠나요? 솔직한 한마디',
    prompts: ['좋았던 점 한 가지', '아쉬웠던 점 한 가지', '다음에 꼭 다뤘으면 하는 주제', '오늘 가장 인상적이었던 장면', '한 줄 감상 (이모지도 환영!)', '궁금한 점이 있다면?'] },
  cheer:      { emoji: '📣', label: '응원 메시지', title: '힘내요, 우리 팀!',
    prompts: ['지금 이 사람에게 필요한 말', '내가 받았던 최고의 응원 한마디', '오늘의 파이팅 한 줄', '말하긴 쑥스러웠던 칭찬', '당신이 있어서 든든한 이유', '이번 주 수고했어요 한마디'] },
};
const COLORS = [
  ['yellow', '노랑'], ['pink', '분홍'], ['mint', '민트'], ['blue', '파랑'],
];
const STICKERS = ['🎉', '💖', '🌟', '🍀', '🎂', '🔥', '👏', '😆'];
const REACTIONS = ['❤️', '🎉', '👏', '😂', '🔥', '✨'];
const ERRORS = {
  CLOSED: '마감되어 더 이상 쓸 수 없어요 🔒',
  COOLDOWN: '조금만 천천히! 3초 뒤에 다시 붙여주세요 ⏱️',
  FULL: '이 롤링페이퍼는 포스트잇이 가득 찼어요 (최대 300장)',
  PHOTO_FULL: '사진은 보드당 60장까지 붙일 수 있어요 📷',
  FORBIDDEN: '관리자 권한이 없어요',
  NOT_FOUND: '찾을 수 없는 항목이에요',
  DUPLICATE: '이미 있는 코드예요. 다시 시도해주세요',
  STORAGE_FULL: '브라우저 저장공간이 가득 찼어요 (데모 모드)',
  INVALID: '입력값을 확인해주세요',
};
const errMsg = (e) => ERRORS[e?.code] || ERRORS[e?.message] || '문제가 생겼어요. 잠시 후 다시 시도해주세요';

const app = $('#app');
let store;
const S = {                       // 현재 보드 화면의 상태
  board: null, notes: new Map(), els: new Map(), hearted: new Set(), mine: [],
  admin: null, unsub: null, tick: null, closedShown: false, photo: null, lastPost: 0,
  presence: 1, ui: {}, wasClosed: false,
};

// ======================================================================
// 부팅 / 라우팅
// ======================================================================
boot();

async function boot() {
  document.documentElement.dataset.mode = MODE;
  await initStore();
  const params = new URLSearchParams(location.search);
  const code = (params.get('b') || '').toLowerCase().trim();
  try {
    if (code) await showBoard(code, params.get('k'));
    else showHome();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('main', { class: 'center-msg' }, h('h1', null, '앗, 문제가 생겼어요'),
      h('p', null, errMsg(e)), h('a', { class: 'btn', href: location.pathname }, '처음으로')));
  }
  document.body.classList.add('ready');
}

async function initStore() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) {
    try {
      const { createSupabaseStore } = await import('./store-supabase.js');
      store = await createSupabaseStore(CONFIG);
      await store.init();
      return;
    } catch (e) {
      console.warn('Supabase 연결 실패 → 데모 모드', e);
      S.fallback = true;
    }
  }
  const { createLocalStore } = await import('./store-local.js');
  store = createLocalStore();
  await store.init();
}

const go = (code, extra = '') => { location.href = `${location.pathname}?b=${encodeURIComponent(code)}${extra}`; };
const homeHref = () => location.pathname;

function demoBanner() {
  if (store.mode !== 'local') return null;
  return h('div', { class: 'demo-banner', role: 'note' },
    S.fallback ? '⚠️ 서버에 연결하지 못해 데모 모드로 실행 중이에요 (이 브라우저 안에서만 저장돼요)'
      : '🧪 데모 모드 — 이 브라우저(탭끼리)에서만 저장·동기화돼요. Supabase 키를 넣으면 모두와 실시간으로 연결돼요.');
}

// ======================================================================
// 홈: 보드 만들기 / 입장
// ======================================================================
function showHome() {
  document.title = '우리 팀 롤링페이퍼';
  let theme = 'birthday';
  let titleTouched = false;

  const titleInput = h('input', {
    id: 'f-title', name: 'title', maxlength: 40, required: true, autocomplete: 'off', value: THEMES[theme].title,
    oninput: () => { titleTouched = true; },
  });
  const deadlineInput = h('input', { id: 'f-deadline', type: 'datetime-local' });
  const secretInput = h('input', { id: 'f-secret', type: 'checkbox' });

  const themeChips = Object.entries(THEMES).map(([key, t]) =>
    h('label', { class: 'chip-radio' },
      h('input', {
        type: 'radio', name: 'theme', value: key, checked: key === theme,
        onchange: () => {
          theme = key;
          if (!titleTouched) titleInput.value = THEMES[key].title;
        },
      }), h('span', null, `${t.emoji} ${t.label}`)));

  const quick = (label, ms) => h('button', {
    type: 'button', class: 'chip-btn',
    onclick: () => { deadlineInput.value = toLocalInput(new Date(Date.now() + ms).toISOString()); },
  }, label);

  const form = h('form', {
    class: 'card create', id: 'create-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const token = randomId(16);
        let board;
        for (let i = 0; i < 6 && !board; i++) {
          const code = randomCode(6);
          try {
            board = await store.createBoard({
              code, title: titleInput.value.trim(), theme,
              deadline: deadlineInput.value ? new Date(deadlineInput.value).toISOString() : null,
              secret: secretInput.checked && !!deadlineInput.value, token,
            });
          } catch (er) { if (er.code !== 'DUPLICATE') throw er; }
        }
        if (!board) throw Object.assign(new Error('DUPLICATE'), { code: 'DUPLICATE' });
        storage.set(`rp.admin.${board.code}`, token);
        rememberBoard(board);
        sessionStorage.setItem('rp.justCreated', board.code);
        go(board.code);
      } catch (er) {
        toast(errMsg(er), 'error');
        btn.disabled = false;
      }
    },
  },
  h('h2', null, '✨ 새 롤링페이퍼 만들기'),
  h('div', { class: 'field' }, h('span', { class: 'label' }, '어떤 자리인가요?'), h('div', { class: 'chips', role: 'radiogroup' }, themeChips)),
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'f-title' }, '제목 (○○를 바꿔주세요)'), titleInput),
  h('div', { class: 'field' },
    h('label', { class: 'label', for: 'f-deadline' }, '마감 시간 (선택)'),
    deadlineInput,
    h('div', { class: 'chips small' }, quick('1시간 후', 3600e3), quick('오늘 밤', (() => { const d = new Date(); d.setHours(23, 0, 0, 0); return Math.max(d - Date.now(), 600e3); })()), quick('내일', 864e5), quick('일주일', 6048e5),
      h('button', { type: 'button', class: 'chip-btn', onclick: () => { deadlineInput.value = ''; } }, '마감 없음'))),
  h('label', { class: 'check' }, secretInput,
    h('span', null, h('b', null, '🤫 서프라이즈 모드'), h('small', null, '마감 전엔 서로의 글이 안 보이다가, 마감 시각에 한꺼번에 공개돼요 (마감 시간 필요)'))),
  h('button', { class: 'btn primary big', type: 'submit' }, '롤링페이퍼 만들기 →'));

  const joinInput = h('input', { id: 'f-join', placeholder: '코드 또는 초대 링크', autocomplete: 'off', 'aria-label': '초대 코드 또는 링크' });
  const join = h('form', {
    class: 'card join',
    onsubmit: (e) => {
      e.preventDefault();
      const raw = joinInput.value.trim();
      let code = raw;
      try { code = new URL(raw).searchParams.get('b') || raw; } catch { /* 코드로 취급 */ }
      code = code.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (code.length < 4) return toast('코드를 확인해주세요', 'error');
      go(code);
    },
  }, h('h2', null, '🔑 초대받았나요?'), h('div', { class: 'row' }, joinInput, h('button', { class: 'btn', type: 'submit' }, '입장')));

  const recent = storage.get('rp.recent', []);
  const recentCard = recent.length ? h('section', { class: 'card recent' }, h('h2', null, '🕘 최근 방문'),
    h('ul', { class: 'recent-list' }, recent.map((r) => h('li', null,
      h('a', { href: `${location.pathname}?b=${r.code}` }, `${THEMES[r.theme]?.emoji || '📝'} ${r.title}`,
        storage.get(`rp.admin.${r.code}`) ? h('span', { class: 'tag' }, '관리자') : null))))) : null;

  app.replaceChildren(
    demoBanner(),
    h('main', { class: 'home' },
      h('header', { class: 'hero' },
        h('div', { class: 'hero-notes', 'aria-hidden': 'true' }, ['yellow', 'pink', 'mint', 'blue'].map((c, i) =>
          h('span', { class: `mini-note color-${c}`, dataset: { i } }, ['생일 축하해요!', '늘 고마워요', '올해도 파이팅', '최고!'][i]))),
        h('h1', null, '우리 팀 롤링페이퍼'),
        h('p', null, '링크 하나로 모두의 마음을 모아요 — 하트, 사진, 마감 공개까지. 가입도 결제도 없어요.')),
      form, join, recentCard,
      h('footer', { class: 'foot' }, '개인·비상업용 · Vercel Hobby + Supabase Free 로 0원 운영')));
}

function rememberBoard(b) {
  const list = storage.get('rp.recent', []).filter((x) => x.code !== b.code);
  list.unshift({ code: b.code, title: b.title, theme: b.theme, ts: Date.now() });
  storage.set('rp.recent', list.slice(0, 8));
}

// ======================================================================
// 보드
// ======================================================================
const nowMs = () => store.now();
const deadlineMs = () => (S.board?.deadline ? Date.parse(S.board.deadline) : null);
const isClosed = () => deadlineMs() != null && nowMs() >= deadlineMs();
const isHidden = () => !!S.board?.secret && !isClosed();   // 비밀 모드 + 아직 마감 전
const theme = () => THEMES[S.board.theme] || THEMES.birthday;

async function showBoard(code, adminKey) {
  app.replaceChildren(h('main', { class: 'center-msg' }, h('div', { class: 'spinner', 'aria-hidden': 'true' }), h('p', null, '보드를 불러오는 중…')));
  const board = await store.getBoard(code);
  if (!board) {
    app.replaceChildren(h('main', { class: 'center-msg' }, h('div', { class: 'big-emoji' }, '🔍'),
      h('h1', null, '이 롤링페이퍼를 찾을 수 없어요'), h('p', null, `코드 “${code}” 를 다시 확인해주세요.`),
      h('a', { class: 'btn primary', href: homeHref() }, '새로 만들기')));
    return;
  }
  S.board = board;
  document.documentElement.dataset.theme = board.theme;
  document.title = `${board.title} · 우리 팀 롤링페이퍼`;

  // 관리자 토큰: 링크(?k=)로 들어오면 검증 후 저장하고 주소창에서 제거
  const saved = storage.get(`rp.admin.${code}`);
  const candidate = adminKey || saved;
  if (candidate && await store.adminCheck(code, candidate)) {
    S.admin = candidate;
    storage.set(`rp.admin.${code}`, candidate);
    if (adminKey) history.replaceState(null, '', `${location.pathname}?b=${code}`);
  } else if (saved) storage.del(`rp.admin.${code}`);
  rememberBoard(board);

  S.mine = storage.get(`rp.mine.${code}`, []);
  buildBoardPage();
  await refreshNotes();
  S.wasClosed = isClosed();
  applyPhase(true);

  S.unsub = store.subscribe(board, {
    onInsert: (row) => { if (!isHidden()) upsertNote(row, true); },
    onUpdate: (row) => { if (!isHidden()) upsertNote(row, false); },
    onDelete: (id) => removeNote(id),
    onBoard: async (row) => { Object.assign(S.board, row); await onBoardChanged(); },
    onPresence: (n) => { S.presence = n; renderPresence(); },
    onReaction: (emoji) => { if (REACTIONS.includes(emoji)) floatEmoji(emoji, S.ui.floor); },
  });
  S.tick = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNotes(); });

  if (sessionStorage.getItem('rp.justCreated') === code) {
    sessionStorage.removeItem('rp.justCreated');
    confetti({ count: 180 });
    openShare(true);
  }
}

async function refreshNotes() {
  const [rows, hearted] = await Promise.all([
    store.listNotes(S.board),
    store.myHearts(S.board).catch(() => new Set()),
  ]);
  S.hearted = hearted;
  S.notes.clear();
  for (const el of S.els.values()) el.remove();
  S.els.clear();
  for (const r of rows) S.notes.set(r.id, r);
  // 비밀 모드에서는 내가 쓴 글만 보임 (서버가 남의 글은 내려주지 않음)
  if (isHidden()) for (const m of S.mine) if (!S.notes.has(m.id)) S.notes.set(m.id, { ...m, _secretMine: true });
  renderAllNotes(false);
}

function renderAllNotes(animate) {
  const board = S.ui.board;
  for (const el of S.els.values()) el.remove();
  S.els.clear();
  const rows = [...S.notes.values()].sort((a, b) => b.id - a.id);
  rows.forEach((n, i) => {
    const el = noteEl(n);
    if (animate) { el.classList.add('reveal-in'); el.style.setProperty('--delay', `${Math.min(i, 30) * 70}ms`); }
    S.els.set(n.id, el);
    board.append(el);
  });
  refreshMvp(); renderEmpty(); renderCounts();
}

function upsertNote(row, isNew) {
  const had = S.notes.has(row.id);
  S.notes.set(row.id, { ...S.notes.get(row.id), ...row, _secretMine: false });
  const n = S.notes.get(row.id);
  if (had && S.els.has(row.id)) {
    const old = S.els.get(row.id);
    const fresh = noteEl(n);
    const oldHeart = $('.heart-count', old)?.textContent;
    old.replaceWith(fresh); S.els.set(row.id, fresh);
    if (oldHeart != null && oldHeart !== String($('.heart-count', fresh)?.textContent)) fresh.classList.add('bump');
  } else if (!had) {
    const el = noteEl(n);
    el.classList.add(isNew ? 'just-added' : 'reveal-in');
    S.els.set(n.id, el);
    S.ui.board.prepend(el);
    if (isNew) setTimeout(() => el.classList.remove('just-added'), 2400);
  }
  refreshMvp(); renderEmpty(); renderCounts();
}

function removeNote(id) {
  S.notes.delete(id);
  const el = S.els.get(id);
  if (el) { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); S.els.delete(id); }
  S.mine = S.mine.filter((m) => m.id !== id);
  storage.set(`rp.mine.${S.board.code}`, S.mine);
  refreshMvp(); renderEmpty(); renderCounts();
}

function refreshMvp() {
  let top = null;
  for (const n of S.notes.values()) if (n.hearts >= 2 && (!top || n.hearts > top.hearts)) top = n;
  for (const [id, el] of S.els) el.classList.toggle('mvp', !!top && id === top.id);
}

function renderEmpty() {
  const box = S.ui.empty;
  const count = S.notes.size;
  box.hidden = count > 0;
  if (count > 0) return;
  box.replaceChildren(
    h('div', { class: 'big-emoji' }, isHidden() ? '🤫' : '📝'),
    h('p', null, isHidden() ? '서프라이즈 모드예요! 마감 시각에 모든 글이 한꺼번에 공개돼요.' : '첫 번째 포스트잇을 붙여볼까요?'));
}

function renderCounts() {
  if (S.ui.count) S.ui.count.textContent = isHidden() ? `내가 쓴 글 ${S.notes.size}장` : `포스트잇 ${S.notes.size}장`;
}

function renderPresence() {
  if (S.ui.presence) S.ui.presence.textContent = `👀 ${Math.max(1, S.presence)}명`;
}

// ---------- 포스트잇 한 장 ----------
function noteEl(n, { preview = false, photoSrc } = {}) {
  const liked = S.hearted.has(n.id);
  const src = photoSrc || (n.photo_path ? store.photoUrl(n.photo_path) : '');
  const el = h('article', {
    class: `note color-${n.color}${src ? ' has-photo' : ''}${preview ? ' preview' : ''}${n._secretMine ? ' secret-mine' : ''}`,
    dataset: { id: n.id },
  },
  h('span', { class: 'pin', 'aria-hidden': 'true' }),
  h('span', { class: 'crown', 'aria-label': '오늘의 베스트', title: '하트 1등!' }, '👑'),
  n.sticker ? h('span', { class: 'sticker', 'aria-hidden': 'true' }, n.sticker) : null,
  src ? h('figure', { class: 'polaroid' }, h('img', { src, alt: `${n.author}님이 붙인 사진`, loading: 'lazy', decoding: 'async' })) : null,
  h('p', { class: 'msg' }, n.message || '여기에 메시지가 보여요'),
  h('footer', null,
    h('span', { class: 'author' }, `- ${n.author || '익명'}`),
    n._secretMine ? h('span', { class: 'lock-tag' }, '🔒 나만 보임') : null,
    preview || n._secretMine ? null : h('button', {
      class: `heart${liked ? ' on' : ''}`, type: 'button', 'aria-pressed': liked ? 'true' : 'false',
      'aria-label': `하트 ${n.hearts}개`, onclick: (e) => onHeart(n.id, e.currentTarget),
    }, h('span', { class: 'heart-ico', 'aria-hidden': 'true' }, liked ? '♥' : '♡'), h('span', { class: 'heart-count' }, n.hearts || 0)),
    S.admin && !preview && !n._secretMine ? h('button', {
      class: 'del', type: 'button', 'aria-label': '이 글 삭제', title: '삭제', onclick: () => onDelete(n.id),
    }, '🗑') : null));
  el.style.setProperty('--rot', `${((seeded(n.id || 7) - 0.5) * 7).toFixed(2)}deg`);
  el.style.setProperty('--lift', `${(seeded((n.id || 3) + 11) * 6).toFixed(1)}px`);
  return el;
}

async function onHeart(id, btn) {
  const n = S.notes.get(id);
  if (!n || btn.disabled) return;
  btn.disabled = true;
  const wasLiked = S.hearted.has(id);
  // 낙관적 업데이트
  if (wasLiked) S.hearted.delete(id); else S.hearted.add(id);
  n.hearts = Math.max(0, n.hearts + (wasLiked ? -1 : 1));
  const rect = btn.getBoundingClientRect();
  if (!wasLiked) { confetti({ count: 24, x: (rect.left + rect.width / 2) / innerWidth, y: rect.top / innerHeight, spread: 0.45 }); floatEmoji('💖', S.ui.floor); }
  upsertNote(n, false);
  try {
    const res = await store.toggleHeart(n);
    const cur = S.notes.get(id);
    if (cur) { cur.hearts = res.hearts; res.liked ? S.hearted.add(id) : S.hearted.delete(id); upsertNote(cur, false); }
  } catch (e) {
    wasLiked ? S.hearted.add(id) : S.hearted.delete(id);
    n.hearts = Math.max(0, n.hearts + (wasLiked ? 1 : -1));
    upsertNote(n, false);
    toast(errMsg(e), 'error');
  }
}

async function onDelete(id) {
  if (!confirm('이 포스트잇을 삭제할까요? 되돌릴 수 없어요.')) return;
  try {
    await store.adminDelete(S.board.code, S.admin, id);
    store.announceDelete(S.board, id);
    removeNote(id);
    toast('삭제했어요');
  } catch (e) { toast(errMsg(e), 'error'); }
}

// ======================================================================
// 보드 페이지 DOM
// ======================================================================
function buildBoardPage() {
  const t = theme();
  const ui = S.ui = {};

  ui.chip = h('span', { class: 'chip status', role: 'timer', 'aria-live': 'off' });
  ui.presence = h('span', { class: 'chip', title: '지금 보고 있는 사람' });
  ui.count = h('span', { class: 'chip soft' });

  const act = (icon, label, fn, extra = '') => h('button', { class: `act ${extra}`, type: 'button', onclick: fn, 'aria-label': label }, h('span', { 'aria-hidden': 'true' }, icon), h('b', null, label));

  ui.banner = h('div', { class: 'banner', hidden: true, role: 'status' });
  ui.board = h('section', { class: 'board', 'aria-label': '포스트잇 보드', 'aria-live': 'polite' });
  ui.empty = h('div', { class: 'empty', hidden: true });
  ui.floor = h('div', { class: 'floor', 'aria-hidden': 'true' });

  const topbar = h('header', { class: 'topbar' },
    h('a', { class: 'back', href: homeHref(), 'aria-label': '처음으로', title: '처음으로' }, '←'),
    h('div', { class: 'titles' },
      h('span', { class: 'theme-emoji', 'aria-hidden': 'true' }, t.emoji),
      h('h1', { id: 'board-title' }, S.board.title)),
    h('div', { class: 'chips' }, ui.chip, ui.presence, ui.count, S.admin ? h('span', { class: 'chip admin' }, '🛠 관리자') : null),
    h('nav', { class: 'actions', 'aria-label': '보드 메뉴' },
      act('📮', '초대', () => openShare(false)),
      act('🎞️', '슬라이드쇼', openSlideshow),
      act('📥', 'CSV', exportCsv),
      MODE === 'mobile' ? act('🖥️', 'PC화면', () => { location.href = `/?b=${S.board.code}&desktop=1`; }) : null,
      S.admin ? act('⚙️', '관리', openSettings, 'accent') : null));

  ui.locked = h('div', { class: 'composer locked-card', hidden: true },
    h('div', { class: 'big-emoji' }, '🔒'), h('h2', null, '작성이 마감되었어요'),
    h('p', { class: 'hint' }, '이제 마음에 드는 글에 하트를 눌러보세요. 슬라이드쇼와 CSV 로 간직할 수도 있어요.'));
  ui.composerWrap = h('aside', { class: 'composer-wrap', id: 'composer', 'aria-label': '메시지 쓰기' }, buildComposer(), ui.locked);
  ui.fab = h('button', {
    class: 'fab', type: 'button', 'aria-controls': 'composer', 'aria-expanded': 'false', onclick: () => toggleComposer(),
  }, h('span', { 'aria-hidden': 'true' }, '✏️'), h('b', null, '쓰기'));
  ui.scrim = h('div', { class: 'scrim', onclick: () => toggleComposer(false) });

  const reactbar = h('div', { class: 'reactbar', role: 'group', 'aria-label': '실시간 이모지 반응' },
    REACTIONS.map((e) => h('button', { type: 'button', 'aria-label': `${e} 보내기`, onclick: () => sendReaction(e) }, e)));

  app.replaceChildren(
    demoBanner(),
    topbar, ui.banner,
    h('main', { class: 'layout' }, ui.composerWrap, h('div', { class: 'board-wrap' }, ui.board, ui.empty)),
    reactbar, ui.fab, ui.scrim, ui.floor);
  renderPresence();
}

let lastReact = 0;
function sendReaction(emoji) {
  floatEmoji(emoji, S.ui.floor);
  if (Date.now() - lastReact < 250) return;
  lastReact = Date.now();
  store.sendReaction(S.board, emoji);
}

// ---------- 작성 폼 ----------
function buildComposer() {
  const ui = S.ui;
  const t = theme();
  const state = { color: 'yellow', sticker: '' };
  S.photo = null;

  ui.nick = h('input', { id: 'c-nick', maxlength: 12, placeholder: '비우면 익명', autocomplete: 'nickname', value: storage.get('rp.nick', '') });
  ui.msg = h('textarea', { id: 'c-msg', maxlength: 100, rows: 3, placeholder: '마음을 남겨주세요 (100자)', required: true });
  ui.counter = h('span', { class: 'counter' }, '0 / 100');
  ui.photoInput = h('input', { type: 'file', accept: 'image/*', class: 'file', id: 'c-photo', 'aria-label': '사진 선택' });
  ui.photoBtn = h('button', { type: 'button', class: 'chip-btn', onclick: () => ui.photoInput.click() }, '📷 사진 붙이기');
  ui.photoThumb = h('div', { class: 'photo-thumb', hidden: true });
  ui.submit = h('button', { class: 'btn primary big', type: 'submit' }, '붙이기 📌');
  ui.previewHost = h('div', { class: 'preview-host', 'aria-hidden': 'true' });

  const renderPreview = () => {
    const n = {
      id: 7, author: ui.nick.value.trim() || '익명', message: ui.msg.value.trim(), color: state.color,
      sticker: state.sticker, hearts: 0, photo_path: null,
    };
    ui.previewHost.replaceChildren(noteEl(n, { preview: true, photoSrc: S.photo?.url }));
    ui.counter.textContent = `${ui.msg.value.length} / 100`;
  };

  ui.msg.addEventListener('input', renderPreview);
  ui.nick.addEventListener('input', renderPreview);
  ui.msg.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') ui.form.requestSubmit(); });

  const colorBtns = COLORS.map(([c, label]) => h('label', { class: `swatch color-${c}`, title: label },
    h('input', { type: 'radio', name: 'color', value: c, checked: c === state.color, 'aria-label': label, onchange: () => { state.color = c; renderPreview(); } }),
    h('span', null)));

  const stickerBtns = [h('label', { class: 'sticker-opt', title: '스티커 없음' },
    h('input', { type: 'radio', name: 'sticker', value: '', checked: true, 'aria-label': '스티커 없음', onchange: () => { state.sticker = ''; renderPreview(); } }), h('span', null, '∅')),
  ...STICKERS.map((s) => h('label', { class: 'sticker-opt' },
    h('input', { type: 'radio', name: 'sticker', value: s, 'aria-label': `스티커 ${s}`, onchange: () => { state.sticker = s; renderPreview(); } }), h('span', null, s)))];

  ui.photoInput.addEventListener('change', async () => {
    const f = ui.photoInput.files?.[0];
    ui.photoInput.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('이미지 파일만 붙일 수 있어요', 'error');
    ui.photoBtn.disabled = true; ui.photoBtn.textContent = '사진 줄이는 중…';
    try {
      const blob = await compressImage(f);
      if (S.photo?.url) URL.revokeObjectURL(S.photo.url);
      S.photo = { blob, url: URL.createObjectURL(blob) };
      ui.photoThumb.replaceChildren(h('img', { src: S.photo.url, alt: '선택한 사진 미리보기' }),
        h('button', { type: 'button', class: 'x', 'aria-label': '사진 빼기', onclick: clearPhoto }, '✕'));
      ui.photoThumb.hidden = false;
      renderPreview();
    } catch (e) { toast(e.message || '사진을 불러오지 못했어요', 'error'); }
    ui.photoBtn.disabled = false; ui.photoBtn.textContent = '📷 사진 바꾸기';
  });

  function clearPhoto() {
    if (S.photo?.url) URL.revokeObjectURL(S.photo.url);
    S.photo = null; ui.photoThumb.hidden = true; ui.photoThumb.replaceChildren();
    ui.photoBtn.textContent = '📷 사진 붙이기';
    renderPreview();
  }

  const dice = h('button', {
    type: 'button', class: 'chip-btn', title: '쓸 말이 막막할 때',
    onclick: () => {
      const list = t.prompts;
      const p = list[(Math.random() * list.length) | 0];
      ui.msg.placeholder = p; ui.hint.textContent = `💡 ${p}`;
    },
  }, '🎲 뭐라고 쓰지?');
  ui.hint = h('p', { class: 'hint', 'aria-live': 'polite' });

  ui.form = h('form', {
    class: 'composer', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (isClosed()) return toast(ERRORS.CLOSED, 'error');
      const message = ui.msg.value.trim();
      if (!message) { ui.msg.focus(); return toast('메시지를 입력해주세요', 'error'); }
      if (Date.now() - S.lastPost < COOLDOWN_MS) return toast(ERRORS.COOLDOWN, 'error');
      ui.submit.disabled = true; ui.submit.textContent = '붙이는 중…';
      try {
        let photo_path = null;
        if (S.photo) photo_path = await store.uploadPhoto(S.board, S.photo.blob);
        const author = ui.nick.value.trim();
        storage.set('rp.nick', author);
        const row = await store.postNote(S.board, { author, message, color: state.color, sticker: state.sticker, photo_path });
        S.lastPost = Date.now();
        S.mine = [row, ...S.mine.filter((m) => m.id !== row.id)].slice(0, 60);
        storage.set(`rp.mine.${S.board.code}`, S.mine);
        if (isHidden()) { S.notes.set(row.id, { ...row, _secretMine: true }); renderAllNotes(false); }
        else if (!S.notes.has(row.id)) upsertNote(row, true);
        confetti({ count: 90, x: 0.5, y: 0.5 });
        ui.msg.value = ''; ui.hint.textContent = ''; ui.msg.placeholder = '마음을 남겨주세요 (100자)';
        clearPhoto(); renderPreview();
        toggleComposer(false);
        toast(isHidden() ? '붙였어요! 마감 때 모두에게 공개돼요 🤫' : '붙였어요! 📌');
        setTimeout(() => { S.els.get(row.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
      } catch (er) {
        toast(errMsg(er), 'error');
        if (er.code === 'CLOSED') applyPhase();
      } finally {
        ui.submit.textContent = '붙이기 📌';
        setTimeout(() => { if (!isClosed()) ui.submit.disabled = false; }, Math.max(0, COOLDOWN_MS - (Date.now() - S.lastPost)));
      }
    },
  },
  h('div', { class: 'sheet-head' }, h('h2', null, '✍️ 한마디 남기기'),
    h('button', { type: 'button', class: 'close', 'aria-label': '닫기', onclick: () => toggleComposer(false) }, '✕')),
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'c-nick' }, '닉네임'), ui.nick),
  h('div', { class: 'field' }, h('div', { class: 'label-row' }, h('label', { class: 'label', for: 'c-msg' }, '메시지'), dice), ui.msg, h('div', { class: 'under' }, ui.hint, ui.counter)),
  h('div', { class: 'field' }, h('span', { class: 'label' }, '포스트잇 색'), h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': '색 고르기' }, colorBtns)),
  h('div', { class: 'field' }, h('span', { class: 'label' }, '스티커'), h('div', { class: 'stickers', role: 'radiogroup', 'aria-label': '스티커 고르기' }, stickerBtns)),
  h('div', { class: 'field' }, ui.photoBtn, ui.photoInput, ui.photoThumb),
  h('div', { class: 'field' }, h('span', { class: 'label' }, '미리보기'), ui.previewHost),
  ui.submit);
  renderPreview();
  return ui.form;
}

function toggleComposer(force) {
  const open = force ?? !app.classList.contains('composer-open');
  app.classList.toggle('composer-open', open);
  S.ui.fab.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => S.ui.msg.focus(), 250);
}

// ======================================================================
// 마감 / 공개 단계
// ======================================================================
function tick() {
  const closed = isClosed();
  if (closed !== S.wasClosed) { S.wasClosed = closed; onPhaseChanged(); }
  renderChip();
}

function renderChip() {
  const chip = S.ui.chip;
  const d = deadlineMs();
  if (d == null) { chip.textContent = '♾️ 마감 없음'; chip.dataset.state = 'open'; return; }
  if (isClosed()) { chip.textContent = '🔒 마감됨'; chip.dataset.state = 'closed'; return; }
  const left = d - nowMs();
  chip.textContent = `⏳ 마감까지 ${fmtRemain(left)}`;
  chip.dataset.state = left < 600e3 ? 'urgent' : 'open';
}

function applyPhase(initial = false) {
  const closed = isClosed();
  const ui = S.ui;
  ui.form.hidden = closed;
  ui.locked.hidden = !closed;
  ui.submit.disabled = closed;
  for (const el of $$('input,textarea,button.chip-btn', ui.form)) el.disabled = closed;
  ui.banner.hidden = false;
  if (closed) {
    ui.banner.dataset.kind = 'closed';
    ui.banner.textContent = `🔒 작성이 마감되었어요 (${fmtDateTime(S.board.deadline)}). 이제 공개 모드 — 마음에 드는 글에 하트를 눌러보세요!`;
  } else if (S.board.secret) {
    ui.banner.dataset.kind = 'secret';
    ui.banner.textContent = `🤫 서프라이즈 모드 — ${fmtDateTime(S.board.deadline)} 까지는 내가 쓴 글만 보이고, 마감되면 한꺼번에 공개돼요.`;
  } else if (S.board.deadline) {
    ui.banner.dataset.kind = 'info';
    ui.banner.textContent = `⏰ ${fmtDateTime(S.board.deadline)} 까지 남겨주세요!`;
  } else ui.banner.hidden = true;
  ui.fab.hidden = closed;
  renderChip(); renderCounts();

  // 이미 공개된 비밀 보드에 처음 들어오면 봉투 연출
  if (initial && S.board.secret && closed && !storage.get(`rp.revealed.${S.board.code}`) && S.notes.size) envelopeCeremony();
}

async function onPhaseChanged() {
  applyPhase();
  if (isClosed()) {
    toast('⏰ 마감됐어요!');
    if (S.board.secret) { await refreshNotes(); envelopeCeremony(); }
    else confetti({ count: 120 });
  } else {
    await refreshNotes();
  }
}

async function onBoardChanged() {
  document.title = `${S.board.title} · 우리 팀 롤링페이퍼`;
  $('#board-title').textContent = S.board.title;
  S.wasClosed = isClosed();
  applyPhase();
  await refreshNotes();
}

function envelopeCeremony() {
  storage.set(`rp.revealed.${S.board.code}`, 1);
  const open = h('button', { class: 'btn primary big pulse', type: 'button' }, '💌 열어보기');
  const ov = h('div', { class: 'overlay envelope', role: 'dialog', 'aria-modal': 'true', 'aria-label': '롤링페이퍼 공개' },
    h('div', { class: 'env-card' }, h('div', { class: 'big-emoji bounce' }, '💌'),
      h('h2', null, '롤링페이퍼가 도착했어요!'), h('p', null, `${S.notes.size}장의 마음이 기다리고 있어요`), open));
  document.body.append(ov);
  open.focus();
  open.addEventListener('click', () => {
    ov.remove(); confetti({ count: 220, spread: 1.4 });
    renderAllNotes(true);
  });
}

// ======================================================================
// 모달류: 초대 / 슬라이드쇼 / CSV / 관리
// ======================================================================
function modal(title, ...content) {
  const prev = document.activeElement;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const ov = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => { if (e.target === ov) close(); } },
    h('div', { class: 'dialog' }, h('div', { class: 'sheet-head' }, h('h2', null, title),
      h('button', { type: 'button', class: 'close', 'aria-label': '닫기', onclick: close }, '✕')), ...content));
  document.body.append(ov);
  document.addEventListener('keydown', onKey);
  $('.close', ov).focus();
  return { ov, close };
}

function inviteUrl() { return `${location.origin}${location.pathname.replace(/m\/?$/, '')}?b=${S.board.code}`; }

async function openShare(justCreated) {
  const url = inviteUrl();
  const qrHost = h('div', { class: 'qr', 'aria-live': 'polite' }, '…');
  const adminUrl = S.admin ? `${url}&k=${S.admin}` : null;
  const linkInput = h('input', { readonly: true, value: url, 'aria-label': '초대 링크', onfocus: (e) => e.target.select() });
  const m = modal(justCreated ? '🎉 롤링페이퍼가 만들어졌어요!' : '📮 팀원 초대하기',
    justCreated ? h('p', { class: 'lead' }, '링크나 QR을 공유하면 바로 쓸 수 있어요. 휴대폰에서 열면 모바일 화면으로 자동 이동해요.') : null,
    qrHost,
    h('div', { class: 'row' }, linkInput,
      h('button', { class: 'btn primary', type: 'button', onclick: async () => toast((await copyText(url)) ? '링크를 복사했어요 📋' : '복사하지 못했어요', 'info') }, '링크 복사'),
      navigator.share ? h('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ title: S.board.title, url }).catch(() => {}) }, '공유') : null),
    adminUrl ? h('div', { class: 'admin-box' },
      h('b', null, '🛠 관리자 링크 (나만 보관하세요)'),
      h('small', null, '다른 기기에서도 글 삭제·마감 변경을 하려면 이 링크로 들어오세요. 남에게 공유하면 안 돼요.'),
      h('button', { class: 'btn', type: 'button', onclick: async () => toast((await copyText(adminUrl)) ? '관리자 링크를 복사했어요 🔑' : '복사하지 못했어요') }, '관리자 링크 복사')) : null);
  try { qrHost.replaceChildren(await qrSvg(url)); }
  catch { qrHost.textContent = 'QR을 불러오지 못했어요. 링크를 복사해 공유해주세요.'; }
  return m;
}

function exportCsv() {
  if (isHidden() && !S.admin) return toast('마감 후에 내려받을 수 있어요 🤫', 'error');
  const rows = [['번호', '작성자', '메시지', '색', '스티커', '하트', '사진', '작성시각']];
  [...S.notes.values()].sort((a, b) => a.id - b.id).forEach((n, i) => rows.push([
    i + 1, n.author, n.message, COLORS.find((c) => c[0] === n.color)?.[1] || n.color, n.sticker || '', n.hearts,
    n.photo_path && !n.photo_path.includes('#data:') ? store.photoUrl(n.photo_path) : (n.photo_path ? '(데모 사진)' : ''), n.created_at,
  ]));
  if (rows.length === 1) return toast('내려받을 글이 아직 없어요');
  download(`rolling-paper-${S.board.code}.csv`, toCsv(rows));
  toast('CSV 파일을 저장했어요 📥');
}

function openSlideshow() {
  const list = [...S.notes.values()].filter((n) => !n._secretMine).sort((a, b) => a.id - b.id);
  if (!list.length) return toast(isHidden() ? '마감 후에 볼 수 있어요 🤫' : '아직 붙은 글이 없어요');
  let i = 0, playing = true, timer;
  const stage = h('div', { class: 'slide-stage' });
  const bar = h('div', { class: 'slide-bar' });
  const show = () => {
    const n = list[i];
    const el = noteEl(n, { preview: true }); el.classList.add('slide-note');
    const hearts = h('div', { class: 'slide-hearts' }, `♥ ${n.hearts || 0}`);
    stage.replaceChildren(el, hearts);
    bar.textContent = `${i + 1} / ${list.length}`;
  };
  const next = (d = 1) => { i = (i + d + list.length) % list.length; show(); };
  const play = () => { clearInterval(timer); if (playing) timer = setInterval(() => next(1), 5000); };
  const close = () => { clearInterval(timer); ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') { next(1); play(); }
    else if (e.key === 'ArrowLeft') { next(-1); play(); }
    else if (e.key === ' ') { playing = !playing; play(); e.preventDefault(); }
  };
  const ov = h('div', { class: 'overlay slideshow', role: 'dialog', 'aria-modal': 'true', 'aria-label': '슬라이드쇼' },
    h('button', { class: 'close big', type: 'button', 'aria-label': '슬라이드쇼 닫기', onclick: close }, '✕'),
    h('button', { class: 'nav prev', type: 'button', 'aria-label': '이전', onclick: () => { next(-1); play(); } }, '‹'),
    stage,
    h('button', { class: 'nav next', type: 'button', 'aria-label': '다음', onclick: () => { next(1); play(); } }, '›'),
    h('div', { class: 'slide-foot' }, bar, h('button', { class: 'btn', type: 'button', onclick: (e) => { playing = !playing; e.currentTarget.textContent = playing ? '⏸ 일시정지' : '▶ 재생'; play(); } }, '⏸ 일시정지')));
  document.body.append(ov);
  document.addEventListener('keydown', onKey);
  show(); play();
}

function openSettings() {
  const title = h('input', { id: 's-title', value: S.board.title, maxlength: 40 });
  const dl = h('input', { id: 's-deadline', type: 'datetime-local', value: toLocalInput(S.board.deadline) });
  const secret = h('input', { id: 's-secret', type: 'checkbox', checked: S.board.secret });
  const st = { clear: false };
  const add = (label, ms) => h('button', { type: 'button', class: 'chip-btn', onclick: () => { st.clear = false; dl.value = toLocalInput(new Date(Math.max(nowMs(), deadlineMs() || 0) + ms).toISOString()); } }, label);
  const m = modal('⚙️ 보드 관리',
    h('div', { class: 'field' }, h('label', { class: 'label', for: 's-title' }, '제목'), title),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 's-deadline' }, '마감 시간'), dl,
      h('div', { class: 'chips small' }, add('+10분', 600e3), add('+1시간', 3600e3), add('+1일', 864e5),
        h('button', { type: 'button', class: 'chip-btn', onclick: () => { st.clear = false; dl.value = toLocalInput(new Date(nowMs() + 1000).toISOString()); } }, '지금 마감·공개'),
        h('button', { type: 'button', class: 'chip-btn', onclick: () => { st.clear = true; dl.value = ''; } }, '마감 없애기'))),
    h('label', { class: 'check' }, secret, h('span', null, h('b', null, '🤫 서프라이즈 모드'), h('small', null, '마감 전에는 서로의 글을 숨겨요'))),
    h('p', { class: 'hint' }, '각 포스트잇의 🗑 버튼으로 부적절한 글을 지울 수 있어요.'),
    h('button', {
      class: 'btn primary big', type: 'button',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        try {
          const wantSecret = secret.checked && (!!dl.value || (!st.clear && !!S.board.deadline));
          const row = await store.adminUpdate(S.board.code, S.admin, {
            title: title.value, deadline: dl.value ? new Date(dl.value).toISOString() : null, clearDeadline: st.clear || !dl.value, secret: wantSecret,
          });
          Object.assign(S.board, row);
          m.close(); await onBoardChanged(); toast('저장했어요 ✅');
        } catch (er) { toast(errMsg(er), 'error'); e.currentTarget.disabled = false; }
      },
    }, '저장'));
}
