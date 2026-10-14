// 데모(로컬) 저장소: Supabase 설정이 없을 때 사용. localStorage + BroadcastChannel 로
// 같은 브라우저의 여러 탭 사이에서 실시간 동기화까지 흉내 낸다. store-supabase.js 와 같은 인터페이스.
import { randomId, storage } from './util.js';

const KEY = 'rp.local.db.v1';
const clientId = (() => {
  let id = storage.get('rp.clientId');
  if (!id) { id = randomId(16); storage.set('rp.clientId', id); }
  return id;
})();

const load = () => storage.get(KEY, null) || { boards: [], notes: [], hearts: [], seq: 1 };
const save = (db) => {
  if (!storage.set(KEY, db)) throw new Error('STORAGE_FULL');
};
const err = (code) => Object.assign(new Error(code), { code });
const isOpen = (b, now) => !b.deadline || now < new Date(b.deadline).getTime();
const isReadable = (b, now) => !b.secret || (b.deadline && now >= new Date(b.deadline).getTime());
const pub = ({ adminToken, ...b }) => b;

export function createLocalStore() {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rp-local') : null;
  const emit = (msg) => bc?.postMessage(msg);

  return {
    mode: 'local',
    clientId,
    now: () => Date.now(),
    async init() { /* 즉시 사용 가능 */ },

    async getBoard(code) {
      const b = load().boards.find((x) => x.code === String(code).toLowerCase());
      return b ? pub(b) : null;
    },

    async createBoard({ code, title, theme, deadline, secret, token }) {
      const db = load();
      if (db.boards.some((b) => b.code === code)) throw err('DUPLICATE');
      const board = {
        id: randomId(8), code, title, theme, deadline: deadline || null, secret: !!secret,
        created_at: new Date().toISOString(), adminToken: token,
      };
      db.boards.push(board); save(db);
      return pub(board);
    },

    async listNotes(board) {
      const db = load();
      const b = db.boards.find((x) => x.id === board.id);
      if (!b || !isReadable(b, Date.now())) return [];
      return db.notes.filter((n) => n.board_id === b.id).sort((a, z) => z.id - a.id);
    },

    async postNote(board, { author, message, color, sticker, photo_path }) {
      const db = load();
      const b = db.boards.find((x) => x.id === board.id);
      if (!b) throw err('NOT_FOUND');
      if (!isOpen(b, Date.now())) throw err('CLOSED');
      const mine = db.notes.filter((n) => n.board_id === b.id);
      if (mine.some((n) => n.client === clientId && Date.now() - n.ts < 3000)) throw err('COOLDOWN');
      if (mine.length >= 300) throw err('FULL');
      if (photo_path && mine.filter((n) => n.photo_path).length >= 60) throw err('PHOTO_FULL');
      const note = {
        id: db.seq++, board_id: b.id, author: (author || '').trim() || '익명', message: message.trim(),
        color, sticker: sticker || null, photo_path: photo_path || null, hearts: 0,
        created_at: new Date().toISOString(), client: clientId, ts: Date.now(),
      };
      db.notes.push(note); save(db);
      const { client, ts, ...row } = note;
      emit({ t: 'insert', board: b.id, row });
      return row;
    },

    async toggleHeart(note) {
      const db = load();
      const n = db.notes.find((x) => x.id === note.id);
      if (!n) throw err('NOT_FOUND');
      const idx = db.hearts.findIndex((h) => h.note === n.id && h.client === clientId);
      let liked;
      if (idx >= 0) { db.hearts.splice(idx, 1); n.hearts = Math.max(0, n.hearts - 1); liked = false; }
      else { db.hearts.push({ note: n.id, client: clientId }); n.hearts += 1; liked = true; }
      save(db);
      const { client, ts, ...row } = n;
      emit({ t: 'update', board: n.board_id, row });
      return { hearts: n.hearts, liked };
    },

    async myHearts(board) {
      const db = load();
      const ids = new Set(db.notes.filter((n) => n.board_id === board.id).map((n) => n.id));
      return new Set(db.hearts.filter((h) => h.client === clientId && ids.has(h.note)).map((h) => h.note));
    },

    // 데모 모드: 사진은 data URL 로 보관 (경로 자체가 곧 URL)
    async uploadPhoto(board, blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(`${board.code}/${randomId(6)}.jpg#${r.result}`);
        r.onerror = () => reject(new Error('사진을 읽지 못했어요'));
        r.readAsDataURL(blob);
      });
    },
    photoUrl(path) { return path?.includes('#data:') ? path.slice(path.indexOf('#') + 1) : ''; },

    async adminCheck(code, token) {
      const b = load().boards.find((x) => x.code === code);
      return !!b && b.adminToken === token;
    },
    async adminDelete(code, token, noteId) {
      const db = load();
      const b = db.boards.find((x) => x.code === code);
      if (!b || b.adminToken !== token) throw err('FORBIDDEN');
      db.notes = db.notes.filter((n) => !(n.id === noteId && n.board_id === b.id));
      save(db);
    },
    async adminUpdate(code, token, { title, deadline, clearDeadline, secret }) {
      const db = load();
      const b = db.boards.find((x) => x.code === code);
      if (!b || b.adminToken !== token) throw err('FORBIDDEN');
      if (title) b.title = title.trim();
      if (clearDeadline) b.deadline = null; else if (deadline) b.deadline = deadline;
      if (typeof secret === 'boolean') b.secret = secret;
      save(db);
      emit({ t: 'board', board: b.id, row: pub(b) });
      return pub(b);
    },

    // 실시간: 같은 브라우저의 다른 탭 + 접속자 수 + 이모지 반응
    subscribe(board, h) {
      const me = randomId(6);
      const peers = new Map([[me, Date.now()]]);
      const countPeers = () => {
        const cut = Date.now() - 12000;
        for (const [k, t] of peers) if (t < cut) peers.delete(k);
        h.onPresence?.(peers.size);
      };
      const ping = () => { peers.set(me, Date.now()); emit({ t: 'hello', board: board.id, me }); countPeers(); };
      const onMsg = (e) => {
        const m = e.data;
        if (!m || m.board !== board.id) return;
        if (m.t === 'insert') h.onInsert?.(m.row);
        else if (m.t === 'update') h.onUpdate?.(m.row);
        else if (m.t === 'board') h.onBoard?.(m.row);
        else if (m.t === 'delete') h.onDelete?.(m.id);
        else if (m.t === 'react') h.onReaction?.(m.emoji);
        else if (m.t === 'hello') { peers.set(m.me, Date.now()); countPeers(); }
        else if (m.t === 'bye') { peers.delete(m.me); countPeers(); }
      };
      bc?.addEventListener('message', onMsg);
      ping();
      const timer = setInterval(ping, 4000);
      const bye = () => emit({ t: 'bye', board: board.id, me });
      addEventListener('pagehide', bye);
      return () => { clearInterval(timer); bye(); bc?.removeEventListener('message', onMsg); removeEventListener('pagehide', bye); };
    },
    sendReaction(board, emoji) { emit({ t: 'react', board: board.id, emoji }); },
    announceDelete(board, id) { emit({ t: 'delete', board: board.id, id }); },
  };
}
