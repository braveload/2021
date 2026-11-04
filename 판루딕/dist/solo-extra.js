(function (root) {
  'use strict';
  const VERSION = '1.0.0', names = { chain: { name: '숫자 연쇄', tag: '카드 연결', version: VERSION }, line: { name: '라인 컨트롤', tag: '영역 전략 · AI', version: VERSION } };
  const clone = x => JSON.parse(JSON.stringify(x)), int = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
  const isExtra = s => s && Object.hasOwn(names, s.game);
  const card = id => ({ color: Math.floor(id / 9), number: id % 9 + 1 });
  const connects = (a, b) => card(a).color === card(b).color || Math.abs(card(a).number - card(b).number) === 1;
  function random(s) { let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
  const windows = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    if (r + 2 * dr < 5 && c + 2 * dc >= 0 && c + 2 * dc < 5) windows.push([r * 5 + c, (r + dr) * 5 + c + dc, (r + 2 * dr) * 5 + c + 2 * dc]);
  }
  function lineScore(board) {
    return [1, 2].map(player => {
      const lines = windows.flatMap((w, i) => w.every(index => board[index] === player) ? [i] : []);
      const center = board.filter((n, i) => n === player && Math.floor(i / 5) >= 1 && Math.floor(i / 5) <= 3 && i % 5 >= 1 && i % 5 <= 3).length;
      return { lines, linePoints: lines.length * 3, center, total: lines.length * 3 + center };
    });
  }
  function legalActions(s) {
    if (s.status !== 'playing') return [];
    if (s.game === 'line') return s.data.board.flatMap((n, index) => n === 0 ? [{ type: 'place', index }] : []);
    const d = s.data, actions = [];
    d.offer.forEach((id, index) => { for (const side of ['left', 'right']) if (connects(id, side === 'left' ? d.chain[0] : d.chain.at(-1))) actions.push({ type: 'place', index, side }); });
    if (!actions.length && d.redraws > 0 && d.deck.length) actions.push({ type: 'redraw' });
    return actions;
  }
  function settle(s) {
    const d = s.data;
    if (s.game === 'chain') { if (d.turns === 12) s.status = 'completed'; else if (!legalActions(s).length) s.status = 'lost'; }
    else if (d.moves.length === 20) { const [a, b] = lineScore(d.board); s.status = a.total > b.total ? 'won' : a.total < b.total ? 'lost' : 'draw'; }
    if (s.status !== 'playing') s.finishedAt = s.updatedAt;
  }
  function create(game, options = {}) {
    const now = Number.isFinite(options.now) ? options.now : Date.now(), seed = (Number(options.seed ?? now) >>> 0) || 1;
    const s = { schema: 1, game, ruleVersion: VERSION, id: options.id || `${game}-${seed}-${now}`, seed, rng: seed, status: 'playing', revision: 0, startedAt: now, updatedAt: now, finishedAt: null };
    if (game === 'chain') {
      const deck = Array.from({ length: 36 }, (_, i) => i);
      for (let i = 35; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      s.data = { chain: [deck.shift()], offer: deck.splice(0, 3), deck, discarded: [], turns: 0, redraws: 2, score: 0, actions: [] };
    } else {
      const difficulty = options.difficulty ?? 'normal', starter = options.starter ?? 'human';
      if (!['easy', 'normal', 'hard'].includes(difficulty) || !['human', 'ai'].includes(starter)) throw new RangeError('선후공과 난이도를 선택해주세요.');
      s.data = { board: Array(25).fill(0), moves: [], difficulty, starter, turn: starter === 'human' ? 1 : 2, lastLines: [] };
    }
    settle(s); return s;
  }
  function apply(state, action, now = Date.now()) {
    const legal = legalActions(state).some(a => a.type === action?.type && (a.type === 'redraw' || (a.index === action.index && (state.game !== 'chain' || a.side === action.side))));
    if (!legal) return { state, error: state.status !== 'playing' ? '종료된 경기입니다.' : '놓을 수 있는 카드·위치 또는 재추첨을 선택해주세요.' };
    const s = clone(state), d = s.data; s.revision++; s.updatedAt = Math.max(s.updatedAt, Number.isFinite(now) ? now : s.updatedAt);
    if (s.game === 'chain') {
      if (action.type === 'redraw') { d.discarded.push(...d.offer); d.offer = d.deck.splice(0, 3); d.redraws--; }
      else {
        const id = d.offer[action.index], end = action.side === 'left' ? d.chain[0] : d.chain.at(-1);
        d.score += 2 + (Math.abs(card(id).number - card(end).number) === 1 ? 1 : 0);
        if (action.side === 'left') d.chain.unshift(id); else d.chain.push(id);
        d.offer.splice(action.index, 1, ...d.deck.splice(0, 1)); d.turns++;
      }
      d.actions.push(action.type === 'redraw' ? { type: 'redraw' } : { type: 'place', index: action.index, side: action.side });
    } else {
      const previous = lineScore(d.board)[d.turn - 1].lines;
      d.board[action.index] = d.turn; d.moves.push(action.index);
      d.lastLines = lineScore(d.board)[d.turn - 1].lines.filter(id => !previous.includes(id)); d.turn = 3 - d.turn;
    }
    settle(s); return { state: s, error: '' };
  }
  function result(s) {
    const terminal = s.status !== 'playing', d = s.data;
    if (s.game === 'chain') return { terminal, outcome: s.status, score: d.score, turns: d.turns, stars: d.score >= 30 ? 3 : d.score >= 20 ? 2 : d.score > 0 ? 1 : 0 };
    const [human, ai] = lineScore(d.board);
    return { terminal, outcome: s.status, score: human.total, humanPoints: human.total, aiPoints: ai.total, turns: d.moves.length, difficulty: d.difficulty, starter: d.starter, breakdown: [human, ai] };
  }
  function valid(s) {
    if (!s || s.schema !== 1 || !isExtra(s) || s.ruleVersion !== VERSION || typeof s.id !== 'string' || !s.id || s.id.length > 160 || !int(s.seed, 1, 4294967295) || !int(s.rng, 1, 4294967295) || !int(s.revision, 0, 20) || !Number.isFinite(s.startedAt) || !Number.isFinite(s.updatedAt) || s.updatedAt < s.startedAt || !s.data) return false;
    try {
      const log = s.game === 'chain' ? s.data.actions : s.data.moves;
      if (!Array.isArray(log) || log.length > (s.game === 'chain' ? 14 : 20)) return false;
      let replay = create(s.game, { now: s.startedAt, seed: s.seed, id: s.id, difficulty: s.data.difficulty, starter: s.data.starter });
      for (const entry of log) { const next = apply(replay, s.game === 'chain' ? entry : { type: 'place', index: entry }, s.updatedAt); if (next.error) return false; replay = next.state; }
      return JSON.stringify(replay.data) === JSON.stringify(s.data) && replay.rng === s.rng && replay.revision === s.revision && replay.status === s.status && (s.status === 'playing' ? s.finishedAt === null : s.finishedAt === s.updatedAt);
    } catch { return false; }
  }
  function validRecord(r) {
    if (!r || r.schema !== 1 || !isExtra(r) || r.ruleVersion !== VERSION || typeof r.id !== 'string' || !r.id || r.id.length > 160 || r.terminal !== true || !Number.isFinite(r.finishedAt) || !Number.isFinite(r.elapsedMs) || r.elapsedMs < 0) return false;
    if (r.game === 'chain') return int(r.turns, 0, 12) && int(r.score, r.turns * 2, r.turns * 3) && r.outcome === (r.turns === 12 ? 'completed' : 'lost') && r.stars === (r.score >= 30 ? 3 : r.score >= 20 ? 2 : r.score > 0 ? 1 : 0);
    return r.turns === 20 && ['easy', 'normal', 'hard'].includes(r.difficulty) && ['human', 'ai'].includes(r.starter) && int(r.humanPoints, 0, 153) && int(r.aiPoints, 0, 153) && r.score === r.humanPoints && r.outcome === (r.humanPoints > r.aiPoints ? 'won' : r.humanPoints < r.aiPoints ? 'lost' : 'draw');
  }
  function lineAI(s) {
    if (s.game !== 'line' || s.status !== 'playing' || s.data.turn !== 2) return null;
    const d = s.data, empty = d.board.flatMap((v, index) => v === 0 ? [index] : []);
    if (d.difficulty === 'easy') { const rng = { rng: (s.seed ^ ((d.moves.length + 1) * 2654435761)) >>> 0 || 1 }; return { type: 'place', index: empty[Math.floor(random(rng) * empty.length)] }; }
    function evaluate(board) {
      const [h, a] = lineScore(board); let potential = 0;
      for (const w of windows) { const values = w.map(i => board[i]), x = values.filter(n => n === 2).length, y = values.filter(n => n === 1).length; if (!y) potential += x * x * .18; if (!x) potential -= y * y * .18; }
      return (a.linePoints - h.linePoints) * 10 + (a.center - h.center) + potential;
    }
    const candidates = (board, player) => board.flatMap((v, i) => { if (v) return []; const next = board.slice(); next[i] = player; return [{ index: i, board: next, value: evaluate(next) }]; }).sort((a, b) => player === 2 ? b.value - a.value || a.index - b.index : a.value - b.value || a.index - b.index);
    const ranked = candidates(d.board, 2);
    {
      const humanBefore = lineScore(d.board)[0].linePoints;
      for (const move of ranked) { move.threat = Math.max(0, ...candidates(move.board, 1).map(reply => lineScore(reply.board)[0].linePoints - humanBefore)); move.value -= move.threat * 10; }
      ranked.sort((a, b) => b.value - a.value || a.index - b.index);
    }
    if (d.difficulty === 'normal') return { type: 'place', index: ranked[0].index };
    let best = -Infinity, choice = ranked[0].index;
    for (const move of ranked.slice(0, 10)) {
      let worst = Infinity;
      if (d.moves.length === 19) worst = move.value;
      else for (const reply of candidates(move.board, 1).slice(0, 10)) {
        const value = d.moves.length >= 18 ? reply.value : (candidates(reply.board, 2)[0]?.value ?? reply.value);
        worst = Math.min(worst, value);
      }
      worst -= move.threat * 10;
      if (worst > best) { best = worst; choice = move.index; }
    }
    return { type: 'place', index: choice };
  }
  function extend(base) {
    return { GAMES: Object.freeze({ ...base.GAMES, ...names }), card, connects, lineWindows: windows, lineScore, lineAI,
      create: (game, options) => Object.hasOwn(names, game) ? create(game, options) : base.create(game, options),
      legalActions: s => isExtra(s) ? legalActions(s) : base.legalActions(s), apply: (s, a, now) => isExtra(s) ? apply(s, a, now) : base.apply(s, a, now),
      result: s => isExtra(s) ? result(s) : base.result(s), valid: s => isExtra(s) ? valid(s) : base.valid(s),
      record: s => isExtra(s) ? (!valid(s) || s.status === 'playing' ? null : { schema: 1, id: s.id, game: s.game, ruleVersion: VERSION, finishedAt: s.finishedAt, elapsedMs: Math.max(0, s.finishedAt - s.startedAt), ...result(s) }) : base.record(s),
      validRecord: r => isExtra(r) ? validRecord(r) : base.validRecord(r) };
  }
  const api = { extend }; if (typeof module !== 'undefined') module.exports = api; root.SoloExtra = api;
})(typeof window === 'undefined' ? globalThis : window);
