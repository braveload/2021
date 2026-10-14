// Supabase 저장소: DB(RPC) + Realtime(변경·Presence·Broadcast) + Storage(사진)
// 브라우저에는 공개 가능한 anon/publishable 키만 사용한다. 쓰기는 모두 서버 함수(RPC)가 검증한다.
import { randomId, storage } from './util.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
const BUCKET = 'rp-photos';

const clientId = (() => {
  let id = storage.get('rp.clientId');
  if (!id) { id = randomId(16); storage.set('rp.clientId', id); }
  return id;
})();

function loadSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL; s.onload = resolve;
    s.onerror = () => reject(new Error('Supabase SDK 로드 실패'));
    document.head.append(s);
  });
}

// RPC 에서 RAISE EXCEPTION 'CLOSED' 같은 코드가 message 로 온다
function wrap(error) {
  if (!error) return null;
  const m = String(error.message || '');
  const code = (m.match(/\b(CLOSED|COOLDOWN|FULL|PHOTO_FULL|FORBIDDEN|NOT_FOUND|BAD_CLIENT|BAD_PHOTO|BAD_TOKEN)\b/) || [])[1]
    || (error.code === '23505' ? 'DUPLICATE' : error.code === '23514' ? 'INVALID' : 'ERROR');
  return Object.assign(new Error(code), { code, detail: m });
}

const NOTE_COLS = 'id,board_id,author,message,color,sticker,photo_path,hearts,created_at';

export async function createSupabaseStore({ SUPABASE_URL, SUPABASE_KEY }) {
  await loadSdk();
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  let offset = 0;
  const ok = async (p) => { const { data, error } = await p; if (error) throw wrap(error); return data; };

  return {
    mode: 'supabase',
    clientId,
    now: () => Date.now() + offset,

    async init() {            // 서버 시계와 브라우저 시계 차이 보정 (마감 시각 정확도)
      try {
        const t0 = Date.now();
        const server = new Date(await ok(sb.rpc('rp_now'))).getTime();
        offset = server - (t0 + Date.now()) / 2;
      } catch { offset = 0; }
    },

    async getBoard(code) {
      return ok(sb.from('rp_boards').select('id,code,title,theme,deadline,secret,created_at')
        .eq('code', String(code).toLowerCase()).maybeSingle());
    },

    async createBoard({ code, title, theme, deadline, secret, token }) {
      await ok(sb.rpc('rp_create_board', {
        p_code: code, p_title: title, p_theme: theme, p_deadline: deadline || null, p_secret: !!secret, p_token: token,
      }));
      return this.getBoard(code);
    },

    async listNotes(board) {
      return (await ok(sb.from('rp_notes').select(NOTE_COLS).eq('board_id', board.id)
        .order('created_at', { ascending: false }).limit(300))) || [];
    },

    async postNote(board, { author, message, color, sticker, photo_path }) {
      const rows = await ok(sb.rpc('rp_post_note', {
        p_board: board.id, p_author: author, p_message: message, p_color: color,
        p_sticker: sticker || null, p_photo: photo_path || null, p_client: clientId,
      }));
      const r = Array.isArray(rows) ? rows[0] : rows;
      return {
        id: r.id, board_id: board.id, author: (author || '').trim() || '익명', message: message.trim(), color,
        sticker: sticker || null, photo_path: photo_path || null, hearts: 0, created_at: r.created_at,
      };
    },

    async toggleHeart(note) {
      const rows = await ok(sb.rpc('rp_toggle_heart', { p_note: note.id, p_client: clientId }));
      const r = Array.isArray(rows) ? rows[0] : rows;
      return { hearts: r.hearts, liked: r.liked };
    },

    async myHearts(board) {
      const ids = await ok(sb.rpc('rp_my_hearts', { p_board: board.id, p_client: clientId }));
      return new Set(ids || []);
    },

    async uploadPhoto(board, blob) {
      const path = `${board.code}/${randomId(10)}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
      });
      if (error) throw wrap(error);
      return path;
    },
    photoUrl(path) {
      return path ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : '';
    },

    async adminCheck(code, token) {
      try { return !!(await ok(sb.rpc('rp_admin_check', { p_code: code, p_token: token }))); } catch { return false; }
    },
    async adminDelete(code, token, noteId) {
      await ok(sb.rpc('rp_admin_delete_note', { p_code: code, p_token: token, p_note: noteId }));
    },
    async adminUpdate(code, token, { title, deadline, clearDeadline, secret }) {
      await ok(sb.rpc('rp_admin_update_board', {
        p_code: code, p_token: token, p_title: title ?? null, p_deadline: deadline ?? null,
        p_clear_deadline: !!clearDeadline, p_secret: typeof secret === 'boolean' ? secret : null,
      }));
      return this.getBoard(code);
    },

    subscribe(board, h) {
      const ch = sb.channel(`rp:${board.code}`, {
        config: { presence: { key: randomId(6) }, broadcast: { self: false } },
      });
      const filter = `board_id=eq.${board.id}`;
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rp_notes', filter }, (p) => h.onInsert?.(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rp_notes', filter }, (p) => h.onUpdate?.(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rp_boards', filter: `id=eq.${board.id}` }, (p) => h.onBoard?.(p.new))
        .on('broadcast', { event: 'react' }, ({ payload }) => h.onReaction?.(payload?.emoji))
        .on('broadcast', { event: 'deleted' }, ({ payload }) => h.onDelete?.(payload?.id))
        .on('presence', { event: 'sync' }, () => h.onPresence?.(Object.keys(ch.presenceState()).length))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') ch.track({ t: Date.now() });
          h.onStatus?.(status);
        });
      this._ch = ch;
      return () => sb.removeChannel(ch);
    },
    sendReaction(board, emoji) { this._ch?.send({ type: 'broadcast', event: 'react', payload: { emoji } }); },
    announceDelete(board, id) { this._ch?.send({ type: 'broadcast', event: 'deleted', payload: { id } }); },
  };
}
