/* Popup progress, active-play clocks, and a unified home records view. */
(() => {
  'use strict';
  const ids = ['baseball', 'triple', 'memory'], key = id => `panludiq.popup.${id}.v1`;
  let pausedMs = null, pauseAt = 0, expired = null, tick = null, finishing = false, storageError = false;
  const original = { start, cleanup, finish, finishBaseball, showGameRules, showRecords };
  function note() {
    let tools = document.getElementById('popup-progress-tools');
    if (!tools) {
      tools = document.createElement('div'); tools.id = 'popup-progress-tools'; tools.className = 'popup-progress-tools';
      tools.innerHTML = '<p id="popup-save-status" class="note" role="status"></p><button id="popup-restart" type="button">새 도전</button>';
      document.getElementById('content').before(tools); document.getElementById('popup-restart').addEventListener('click', restartPopup);
    }
    tools.hidden = !active || !ids.includes(state?.id);
    document.getElementById('popup-save-status').textContent = storageError ? '진행을 저장하지 못했습니다. 현재 페이지에서는 계속할 수 있습니다.' : '진행 자동 저장 · 설명/다른 탭에서는 시간 정지';
    document.getElementById('popup-restart').hidden = state?.id === 'baseball';
  }
  function restartPopup() {
    if (!active || !['triple','memory'].includes(state?.id)) return;
    const id = state.id;
    askGameChange('현재 진행을 새 게임으로 바꿀까요? 완료 기록은 유지됩니다.', () => {
      finishing = true; try { cleanup(); } finally { finishing = false; }
      write(key(id), null); original.start(id); save(); badge();
    });
  }
  function write(k, value) { try { if (value === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value)); } catch { storageError = true; } }
  function valid(x, id) {
    if (!x || x.schema !== 1 || x.state?.id !== id || !Number.isFinite(x.remainingMs) || x.remainingMs < 0 || x.remainingMs > 120000 || typeof x.draft !== 'string' || x.draft.length > 4) return false;
    const s = x.state;
    if (id === 'baseball') {
      const g = s.game;
      if (!g || ![3, 4].includes(g.length) || typeof g.secret !== 'string' || !/^\d+$/.test(g.secret) || g.secret.length !== g.length || new Set(g.secret).size !== g.length || !Array.isArray(g.attempts) || g.attempts.length > 9) return false;
      let replay = { length: g.length, secret: g.secret, attempts: [], status: 'playing' };
      for (const a of g.attempts) { const out = E.guessBaseball(replay, a.guess); if (out.error) return false; replay = out.game; }
      return replay.status === 'playing' && JSON.stringify(replay) === JSON.stringify(g);
    }
    if (!Number.isInteger(s.errors) || s.errors < 0 || s.errors > 100000) return false;
    if (id === 'memory') {
      if (!Array.isArray(s.deck) || s.deck.length !== 16 || s.deck.some(n => !Number.isInteger(n) || n < 0 || n > 7) || Array.from({ length: 8 }, (_, i) => s.deck.filter(n => n === i).length).some(n => n !== 2)) return false;
      if (![s.open, s.matched].every(a => Array.isArray(a) && a.every(i => Number.isInteger(i) && i >= 0 && i < 16) && new Set(a).size === a.length) || s.open.length > 2 || s.matched.length > 14 || s.matched.length % 2 || s.open.some(i => s.matched.includes(i))) return false;
      const counts = s.matched.map(i => s.deck[i]); return counts.every(n => counts.filter(v => v === n).length === 2) && typeof s.locked === 'boolean';
    }
    const p = s.puzzle;
    return Number.isInteger(s.round) && s.round >= 1 && s.round <= 6 && Number.isInteger(s.score) && s.score >= 0 && s.score <= 840 && Number.isInteger(s.wrong) && s.wrong >= 0 && s.wrong <= 3 && typeof s.locked === 'boolean'
      && Array.isArray(s.log) && s.log.length <= 6 && s.log.every(v => typeof v === 'string' && v.length < 180 && !/[<>&]/.test(v))
      && Array.isArray(s.selection) && s.selection.length <= 3 && new Set(s.selection).size === s.selection.length && s.selection.every(i => Number.isInteger(i) && i >= 0 && i < 9)
      && p && Array.isArray(p.cards) && p.cards.length === 9 && p.cards.every(c => Array.isArray(c) && c.length === 3 && c.every(n => Number.isInteger(n) && n >= 0 && n <= 2))
      && Array.isArray(p.target) && p.target.length === 3 && p.target.every(n => typeof n === 'boolean' || n === 0 || n === 1)
      && Array.isArray(p.answer) && p.answer.length === 3 && new Set(p.answer).size === 3 && p.answer.every(i => Number.isInteger(i) && i >= 0 && i < 9) && E.matches(p.cards, p.answer, p.target);
  }
  function read(id) {
    let raw;
    try { raw = localStorage.getItem(key(id)); } catch { storageError = true; return null; }
    if (!raw) return null;
    try { const x = JSON.parse(raw); if (valid(x, id)) return x; } catch { /* Preserve malformed JSON before replacement too. */ }
    try { if (!localStorage.getItem(key(id) + '.backup')) localStorage.setItem(key(id) + '.backup', raw); } catch { storageError = true; }
    return null;
  }
  function badge() {
    for (const [game, cls] of [['code','code'],['reverse','lights'],['dice','dice'],['chain','chain'],['line','line']]) {
      try { const s = JSON.parse(localStorage.getItem(`panludiq.solo.${game}.session.v1`)); const el = document.querySelector(`.game-card.${cls} .card-play`); if (el) el.textContent = s && SoloCore.valid(s) && s.status === 'playing' && s.revision > 0 ? '이어서 플레이 →' : '바로 플레이 →'; } catch {}
    }
    for (const id of ids) { const el = document.querySelector(`.game-card.${id} .card-play`); if (el) el.textContent = read(id) ? '이어서 플레이 →' : '바로 플레이 →'; }
  }
  function save() {
    if (!active || finishing || !ids.includes(state?.id)) return;
    const remainingMs = state.id === 'baseball' ? 0 : pausedMs ?? Math.max(0, state.deadline - Date.now());
    const x = { schema: 1, state: JSON.parse(JSON.stringify(state)), remainingMs, draft: state.id === 'baseball' ? document.getElementById('baseball-guess')?.value.slice(0, 4) || '' : '' };
    if (valid(x, state.id)) { write(key(state.id), x); write('panludiq.popup.active.v1', state.id); }
    note();
  }
  function runClock() {
    clearInterval(timer); const sid = session;
    timer = setInterval(() => { if (!active || sid !== session || pausedMs !== null) return; tick?.(); if (Date.now() >= state.deadline) { clearInterval(timer); expired?.(); } }, 100);
  }
  clock = function (seconds, onExpired, onTick) { pausedMs = null; pauseAt = 0; expired = onExpired; tick = onTick; state.deadline = Date.now() + seconds * 1000; runClock(); if (document.hidden || document.querySelector('#game-rules[open],#confirm-dialog[open],#triple-practice[open],#popup-picture-practice[open]')) pause(); };
  remaining = () => Math.max(0, Math.ceil((pausedMs ?? (state.deadline - Date.now())) / 1000));
  function pause() { if (!active || state?.id === 'baseball' || !expired || pausedMs !== null) return; pausedMs = Math.max(0, state.deadline - Date.now()); pauseAt = Date.now(); clearInterval(timer); tick?.(); save(); }
  function resume() { if (!active || pausedMs === null || document.hidden || document.querySelector('#game-rules[open],#confirm-dialog[open],#triple-practice[open],#popup-picture-practice[open]')) return; if (state.id === 'memory') state.start += Date.now() - pauseAt; state.deadline = Date.now() + pausedMs; pausedMs = null; pauseAt = 0; runClock(); save(); }
  cleanup = function () { if (active && !finishing) save(); pausedMs = null; expired = tick = null; original.cleanup(); write('panludiq.popup.active.v1', null); note(); badge(); };
  for (const name of ['finish', 'finishBaseball']) {
    const wrapped = (...args) => {
      const id = state?.id, recordKey = name === 'finishBaseball' ? 'panludiq.baseball.v1' : 'panludiq.records.v1';
      let before; try { before = localStorage.getItem(recordKey); } catch {}
      finishing = true;
      try {
        const value = original[name](...args); let recorded = false;
        try { recorded = localStorage.getItem(recordKey) !== before; } catch {}
        if (recorded) write(key(id), null);
        else if (ids.includes(id)) document.getElementById('content').insertAdjacentHTML('beforeend', '<p class="note">기록 저장을 확인하지 못해 이전 진행을 보존했습니다. 저장 공간을 확보한 뒤 같은 게임에서 다시 완료할 수 있습니다.</p>');
        return value;
      } finally { finishing = false; badge(); }
    };
    if (name === 'finish') finish = wrapped; else finishBaseball = wrapped;
  }
  showGameRules = function (...args) { pause(); return original.showGameRules(...args); };
  document.getElementById('game-rules').addEventListener('close', resume);
  for (const id of ['triple-practice','popup-picture-practice']) { const dialog=document.getElementById(id); if(dialog){dialog.addEventListener('close',resume);new MutationObserver(()=>{if(dialog.open)pause();}).observe(dialog,{attributes:true,attributeFilter:['open']});} }
  document.getElementById('confirm-dialog').addEventListener('close', resume);
  new MutationObserver(() => { if (document.getElementById('confirm-dialog').open) pause(); }).observe(document.getElementById('confirm-dialog'), { attributes: true, attributeFilter: ['open'] });
  function restore(x) {
    original.cleanup(); state = x.state; active = true; openModal(); document.getElementById('active-rules').hidden = false;
    if (state.id === 'baseball') {
      baseballRender(); document.getElementById('baseball-count').textContent = state.game.attempts.length + '/10';
      if (state.game.attempts.length) document.getElementById('baseball-history').innerHTML = baseballHistory();
      document.getElementById('baseball-guess').value = x.draft; document.getElementById('baseball-message').textContent = '저장된 추리와 입력을 이어갑니다.';
    } else if (state.id === 'triple') {
      if (state.locked) { tripleRound(); } else {
        tripleRender(); document.getElementById('score').textContent = state.score;
        document.querySelectorAll('.triple .tile').forEach((el, i) => { el.classList.toggle('selected', state.selection.includes(i)); el.setAttribute('aria-pressed', String(state.selection.includes(i))); });
        document.getElementById('submit').disabled = state.selection.length !== 3;
        clock(x.remainingMs / 1000, () => tripleEnd(false, '시간초과'), () => { document.getElementById('clock').textContent = remaining(); });
      }
    } else {
      state.start = Date.now() - (120000 - x.remainingMs); memoryRender();
      document.getElementById('pairs').textContent = state.matched.length / 2; document.getElementById('errors').textContent = state.errors;
      document.querySelectorAll('.memory .tile').forEach((el, i) => {
        if (state.matched.includes(i) || state.open.includes(i)) { el.textContent = symbols[state.deck[i]]; el.classList.add(state.matched.includes(i) ? 'matched' : 'open'); el.disabled = state.matched.includes(i); el.setAttribute('aria-label', `${i + 1}번 ${symbols[state.deck[i]]}`); }
      });
      if (state.open.length === 2) { state.open = []; state.locked = false; document.querySelectorAll('.memory .tile.open').forEach((el, i) => { el.textContent = '?'; el.classList.remove('open'); el.setAttribute('aria-label', `${Array.from(document.querySelectorAll('.memory .tile')).indexOf(el) + 1}번 카드 뒤집기`); }); }
      clock(x.remainingMs / 1000, () => finishMemory(false), () => { document.getElementById('clock').textContent = remaining(); });
    }
    tick?.(); note(); save();
  }
  start = function (id, length) { const x = ids.includes(id) ? read(id) : null; if (x) restore(x); else original.start(id, length); save(); badge(); };
  for (const type of ['click', 'submit', 'input']) document.addEventListener(type, () => { save(); }, false);
  setInterval(save, 500);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); });
  window.addEventListener('pagehide', () => { pause(); save(); });
  window.addEventListener('pageshow', resume);
  showRecords = function () {
    original.showRecords();
    const link = document.querySelector('.suite-record-link'); if (!link) return;
    let readRecords; try { readRecords = SoloStore.create(localStorage).records(); } catch { readRecords = { rows: [], error: 'storage unavailable' }; }
    const panel = document.createElement('div'); panel.className = 'all-game-records';
    panel.innerHTML = Object.entries(SoloCore.GAMES).map(([id, g]) => {
      const rows = readRecords.rows.filter(r => r.game === id), scores = rows.map(r => r.score).filter(Number.isFinite);
      const detail = id === 'reverse' ? `${rows.filter(r => r.outcome === 'won').length}회 성공 / ${rows.length}경기` : id === 'line' ? `${rows.filter(r => r.outcome === 'won').length}승 ${rows.filter(r => r.outcome === 'draw').length}무 ${rows.filter(r => r.outcome === 'lost').length}패` : `${rows.length}경기 · 최고 ${scores.length ? Math.max(...scores) + '점' : '기록 없음'}`;
      return `<section class="record-summary"><h3>${g.name}</h3><p>${detail}</p></section>`;
    }).join('') + (readRecords.error ? '<p class="note">일부 기록을 읽지 못했습니다. 원본은 보존됩니다.</p>' : '') + '<p class="note">8종 게임의 기록을 한 화면에서 확인할 수 있습니다. 난이도별 상세 기록은 각 게임의 내 기록에서 확인하세요.</p>';
    link.replaceWith(panel);
    const button = document.querySelector('[onclick="clearRecords()"]'); if (button) { button.textContent = '기존 점수·숫자야구·이전 불빛 기록 지우기'; button.insertAdjacentHTML('afterend', '<p class="note">위 삭제 버튼은 독립 싱글 5종의 기록과 진행을 지우지 않습니다.</p>'); }
  };
  badge(); window.addEventListener('load', badge);
  try { const id = JSON.parse(localStorage.getItem('panludiq.popup.active.v1')); if (performance.getEntriesByType('navigation')[0]?.type === 'reload' && ids.includes(id)) { const x = read(id); if (x) restore(x); } } catch { /* No recoverable popup. */ }
})();
