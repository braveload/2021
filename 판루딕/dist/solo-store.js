(function (root) {
  'use strict';
  const Core = typeof module !== 'undefined' ? require('./solo-core.js') : root.SoloCore;
  const PREFIX = 'panludiq.solo.', HISTORY = `${PREFIX}records.v1`;
  function create(storage) {
    const key = game => `${PREFIX}${game}.session.v1`;
    function get(k) { try { return { raw: storage.getItem(k), error: '' }; } catch { return { raw: null, error: '브라우저 저장소에 접근할 수 없습니다.' }; } }
    function load(game) {
      const read = get(key(game)); if (read.error || !read.raw) return { state: null, error: read.error };
      try { const s = JSON.parse(read.raw); if (s.game === game && Core.valid(s)) return { state: s, error: '' }; } catch {}
      return { state: null, error: '저장된 진행의 형식이나 규칙 버전이 맞지 않습니다. 새 도전으로 시작해주세요.' };
    }
    function records() {
      const read = get(HISTORY); if (read.error) return { rows: [], error: read.error, invalid: false };
      if (!read.raw) return { rows: [], error: '', invalid: false };
      try {
        const rows = JSON.parse(read.raw); if (!Array.isArray(rows)) throw Error();
        const valid = rows.filter(Core.validRecord);
        const unique = valid.filter((r, i) => valid.findIndex(x => x.id === r.id && x.game === r.game) === i).slice(0, 100);
        return { rows: unique, error: valid.length === rows.length ? '' : '일부 호환되지 않는 기록은 표시하지 않았습니다.', invalid: valid.length !== rows.length };
      } catch { return { rows: [], error: '완료 기록을 읽지 못했습니다. 새 기록 저장 시 원본을 별도 보존합니다.', invalid: true }; }
    }
    function backup(k) {
      const raw = storage.getItem(k);
      if (raw && !storage.getItem(`${k}.backup`)) storage.setItem(`${k}.backup`, raw);
    }
    function save(s) {
      if (!Core.valid(s)) return { ok: false, error: '유효하지 않은 진행은 저장하지 않았습니다.' };
      try {
        const previous = load(s.game); if (previous.error) backup(key(s.game));
        storage.setItem(key(s.game), JSON.stringify(s));
        const row = Core.record(s);
        if (row) {
          const marker = `${PREFIX}${s.game}.recorded.v1`;
          const read = records(); if (read.invalid) backup(HISTORY);
          const rows = read.rows;
          if ((read.invalid || storage.getItem(marker) !== row.id) && !rows.some(r => r.id === row.id && r.game === row.game)) {
            rows.unshift(row); storage.setItem(HISTORY, JSON.stringify(rows.slice(0, 100)));
          }
          storage.setItem(marker, row.id);
        }
        return { ok: true, error: '' };
      } catch { return { ok: false, error: '진행 또는 완료 기록을 저장하지 못했습니다. 이 페이지에서는 계속 플레이할 수 있습니다.' }; }
    }
    return { load, save, records, sessionKey: key, historyKey: HISTORY };
  }
  const api = { create, PREFIX, HISTORY };
  if (typeof module !== 'undefined') module.exports = api;
  root.SoloStore = api;
})(typeof window === 'undefined' ? globalThis : window);
