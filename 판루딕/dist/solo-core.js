(function (root) {
  'use strict';
  const SCHEMA = 1, VERSION = '1.0.0', TARGET = 65535;
  const GAMES = Object.freeze({
    code: { name: '코드 브레이커', tag: '암호 추리', version: VERSION },
    reverse: { name: '불빛 뒤집기', tag: '자유 · 25회 도전', version: '1.1.0' },
    dice: { name: '전략 주사위', tag: '배치 전략', version: VERSION }
  });
  const integer = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  const clone = x => JSON.parse(JSON.stringify(x));
  function random(s) {
    let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0; return s.rng / 4294967296;
  }
  function shuffle(s, a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function mask(i) {
    let out = 1 << i, r = Math.floor(i / 4), c = i % 4;
    if (r) out |= 1 << (i - 4); if (r < 3) out |= 1 << (i + 4);
    if (c) out |= 1 << (i - 1); if (c < 3) out |= 1 << (i + 1);
    return out;
  }
  function popcount(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }
  let solutions;
  function solution(board) {
    if (!solutions) {
      solutions = new Map([[0, 0]]);
      const outcomes = new Uint16Array(65536);
      for (let presses = 1; presses < 65536; presses++) {
        const bit = presses & -presses, i = 31 - Math.clz32(bit);
        const outcome = outcomes[presses ^ bit] ^ mask(i); outcomes[presses] = outcome;
        const previous = solutions.get(outcome);
        if (previous === undefined || popcount(presses) < popcount(previous)) solutions.set(outcome, presses);
      }
    }
    return solutions.get(board ^ TARGET);
  }
  const LEVELS = Object.freeze({ easy: { name: '쉬움', min: 2, max: 3 }, normal: { name: '보통', min: 4, max: 5 }, hard: { name: '어려움', min: 6, max: 7 } });
  const pools = new Map();
  function lightPool(difficulty) {
    if (!pools.has(difficulty)) {
      solution(TARGET);
      const band = difficulty === 'free' ? { min: 1, max: 7 } : LEVELS[difficulty];
      const entries = [];
      for (const [delta, presses] of solutions) {
        const minimumMoves = popcount(presses);
        if (minimumMoves >= band.min && minimumMoves <= band.max) entries.push({ board: TARGET ^ delta, minimumMoves });
      }
      pools.set(difficulty, entries);
    }
    return pools.get(difficulty);
  }
  function reverseSettings(s) {
    if (s.ruleVersion === VERSION) return { mode: 'challenge', difficulty: 'legacy', limit: 25, minimumMoves: popcount(solution(s.data.initialBoard)) };
    return { mode: s.data.mode, difficulty: s.data.difficulty, limit: s.data.mode === 'free' ? null : 25, minimumMoves: s.data.minimumMoves };
  }
  function clues(secret, guess) {
    let exact = 0, misplaced = 0;
    for (let i = 0; i < 4; i++) { if (guess[i] === secret[i]) exact++; else if (secret.includes(guess[i])) misplaced++; }
    return { exact, misplaced };
  }
  function diceScore(board) {
    const base = board.reduce((a, b) => a + (b || 0), 0), rows = [], columns = [], diagonals = [];
    const full = values => values.every(n => integer(n, 1, 6));
    for (let i = 0; i < 3; i++) {
      const row = board.slice(i * 3, i * 3 + 3), col = [board[i], board[i + 3], board[i + 6]];
      const sum = row.reduce((a, b) => a + (b || 0), 0);
      rows.push(full(row) && sum >= 10 && sum <= 14 ? 10 : 0);
      columns.push(full(col) && new Set(col).size === 3 ? 8 : 0);
    }
    for (const ids of [[0, 4, 8], [2, 4, 6]]) {
      const values = ids.map(i => board[i]);
      diagonals.push(full(values) && new Set(values.map(n => n % 2)).size === 1 ? 6 : 0);
    }
    return { base, rows, columns, diagonals, total: base + [...rows, ...columns, ...diagonals].reduce((a, b) => a + b, 0) };
  }
  function roll(s) { return [1 + Math.floor(random(s) * 6), 1 + Math.floor(random(s) * 6)]; }
  function create(game, options = {}) {
    if (!Object.hasOwn(GAMES, game)) throw new RangeError('지원하지 않는 게임입니다.');
    const now = Number.isFinite(options.now) ? options.now : Date.now(), seed = (Number(options.seed ?? now) >>> 0) || 1;
    const s = { schema: SCHEMA, game, ruleVersion: GAMES[game].version, id: options.id || `${game}-${seed}-${now}`,
      seed, rng: seed, status: 'playing', revision: 0, startedAt: now, updatedAt: now, finishedAt: null };
    if (game === 'code') s.data = { secret: shuffle(s, '01234567'.split('')).slice(0, 4).join(''), attempts: [] };
    else if (game === 'dice') s.data = { board: Array(9).fill(null), pair: roll(s), selected: null, turns: 0 };
    else {
      const mode = options.mode ?? 'challenge', difficulty = mode === 'free' ? null : (options.difficulty ?? 'normal');
      if (!['free', 'challenge'].includes(mode) || (mode === 'challenge' && !Object.hasOwn(LEVELS, difficulty))) throw new RangeError('올바른 모드와 난이도를 선택해주세요.');
      const pool = lightPool(mode === 'free' ? 'free' : difficulty), puzzle = pool[Math.floor(random(s) * pool.length)];
      // A 1 bit means off on the unified screen. Keeping the old encoding and
      // reverse ID preserves existing saved puzzles without rewriting them.
      s.data = { board: puzzle.board, initialBoard: puzzle.board, moves: 0, mode, difficulty, minimumMoves: puzzle.minimumMoves };
    }
    return s;
  }
  function legalActions(s) {
    if (s.status !== 'playing') return [];
    if (s.game === 'code') return [{ type: 'guess', alphabet: '01234567', length: 4, unique: true }];
    if (s.game === 'reverse') return Array.from({ length: 16 }, (_, index) => ({ type: 'press', index }));
    return [{ type: 'select', index: 0 }, { type: 'select', index: 1 }, ...(s.data.selected === null ? [] : s.data.board.flatMap((n, index) => n === null ? [{ type: 'place', index }] : []))];
  }
  function apply(state, action, now = Date.now()) {
    const reject = error => ({ state, error });
    if (state.status !== 'playing') return reject('종료된 경기입니다. 새 도전을 시작해주세요.');
    if (!action || typeof action !== 'object') return reject('조작을 다시 선택해주세요.');
    const d = state.data;
    if (state.game === 'code') {
      if (action.type !== 'guess' || typeof action.value !== 'string' || !/^[0-7]{4}$/.test(action.value)) return reject('0~7 숫자 네 자리를 입력해주세요. 첫 자리 0도 가능합니다.');
      if (new Set(action.value).size !== 4) return reject('서로 다른 숫자 네 개를 입력해주세요.');
      if (d.attempts.some(a => a.guess === action.value)) return reject('이미 제출한 숫자입니다. 횟수는 줄지 않습니다.');
    } else if (state.game === 'reverse') {
      if (action.type !== 'press' || !integer(action.index, 0, 15)) return reject('보드 안의 타일을 선택해주세요.');
    } else {
      if (action.type === 'select' && integer(action.index, 0, 1)) { /* valid choice */ }
      else if (action.type === 'place' && integer(action.index, 0, 8)) {
        if (d.selected === null) return reject('먼저 주사위 하나를 선택해주세요.');
        if (d.board[action.index] !== null) return reject('이미 채운 칸입니다. 빈칸을 선택해주세요.');
      } else return reject('주사위 또는 빈칸을 선택해주세요.');
    }
    const s = clone(state), next = s.data;
    s.revision++; s.updatedAt = Math.max(s.updatedAt, Number.isFinite(now) ? now : s.updatedAt);
    if (s.game === 'code') {
      const hint = clues(next.secret, action.value); next.attempts.push({ guess: action.value, ...hint });
      if (hint.exact === 4) s.status = 'won'; else if (next.attempts.length === 8) s.status = 'lost';
    } else if (s.game === 'reverse') {
      next.board ^= mask(action.index); next.moves++;
      if (next.board === TARGET) s.status = 'won'; else if (reverseSettings(s).limit !== null && next.moves === 25) s.status = 'lost';
    } else if (action.type === 'select') next.selected = action.index;
    else {
      next.board[action.index] = next.pair[next.selected]; next.selected = null; next.turns++;
      if (next.turns === 9) s.status = 'completed'; else next.pair = roll(s);
    }
    if (s.status !== 'playing') s.finishedAt = s.updatedAt;
    return { state: s, error: '' };
  }
  function result(s) {
    const terminal = s.status !== 'playing';
    if (s.game === 'code') return { terminal, outcome: s.status, score: terminal ? (s.status === 'won' ? 1000 - 100 * (s.data.attempts.length - 1) : 0) : null, attempts: s.data.attempts.length };
    if (s.game === 'reverse') {
      const settings = reverseSettings(s);
      return { terminal, outcome: s.status, score: null, moves: s.data.moves, ...settings, stars: s.status === 'won' && settings.mode === 'challenge' ? (s.data.moves <= 10 ? 3 : s.data.moves <= 16 ? 2 : 1) : 0 };
    }
    return { terminal, outcome: s.status, score: diceScore(s.data.board).total, turns: s.data.turns, breakdown: diceScore(s.data.board) };
  }
  function valid(s) {
    if (!s || s.schema !== SCHEMA || !Object.hasOwn(GAMES, s.game) || ![GAMES[s.game].version, ...(s.game === 'reverse' ? [VERSION] : [])].includes(s.ruleVersion) || typeof s.id !== 'string' || !s.id || s.id.length > 160) return false;
    if (!integer(s.rng, 1, 4294967295) || !integer(s.seed, 1, 4294967295) || !integer(s.revision, 0, 1000000) || !Number.isFinite(s.startedAt) || !Number.isFinite(s.updatedAt) || s.updatedAt < s.startedAt) return false;
    if (!['playing', 'won', 'lost', 'completed'].includes(s.status) || (s.status === 'playing' ? s.finishedAt !== null : !Number.isFinite(s.finishedAt) || s.finishedAt !== s.updatedAt)) return false;
    const d = s.data; if (!d || typeof d !== 'object') return false;
    if (s.game === 'code') {
      if (typeof d.secret !== 'string' || !/^[0-7]{4}$/.test(d.secret) || new Set(d.secret).size !== 4 || !Array.isArray(d.attempts) || d.attempts.length > 8) return false;
      const used = new Set(); let expected = 'playing';
      for (const a of d.attempts) {
        if (!a || expected !== 'playing' || typeof a.guess !== 'string' || !/^[0-7]{4}$/.test(a.guess) || new Set(a.guess).size !== 4 || used.has(a.guess)) return false;
        used.add(a.guess); const hint = clues(d.secret, a.guess);
        if (a.exact !== hint.exact || a.misplaced !== hint.misplaced) return false;
        if (a.exact === 4) expected = 'won';
      }
      if (expected === 'playing' && d.attempts.length === 8) expected = 'lost';
      return s.status === expected;
    }
    if (s.game === 'reverse') {
      const legacy = s.ruleVersion === VERSION;
      if (!legacy && (!['free', 'challenge'].includes(d.mode) || (d.mode === 'free' ? d.difficulty !== null : !Object.hasOwn(LEVELS, d.difficulty)))) return false;
      const limit = legacy || d.mode === 'challenge' ? 25 : 1000000;
      if (!integer(d.board, 0, TARGET) || !integer(d.initialBoard, 0, TARGET - 1) || !integer(d.moves, 0, limit) || solution(d.board) === undefined || solution(d.initialBoard) === undefined) return false;
      if (!legacy && (d.minimumMoves !== popcount(solution(d.initialBoard)) || (d.mode === 'challenge' && (d.minimumMoves < LEVELS[d.difficulty].min || d.minimumMoves > LEVELS[d.difficulty].max)))) return false;
      if (d.board === TARGET && d.moves < popcount(solution(d.initialBoard))) return false;
      if (!d.moves && d.board !== d.initialBoard) return false;
      return s.status === (d.board === TARGET ? 'won' : limit === 25 && d.moves === 25 ? 'lost' : 'playing');
    }
    if (!Array.isArray(d.board) || d.board.length !== 9 || d.board.some(n => n !== null && !integer(n, 1, 6)) || !Array.isArray(d.pair) || d.pair.length !== 2 || d.pair.some(n => !integer(n, 1, 6)) || (d.selected !== null && !integer(d.selected, 0, 1))) return false;
    if (!integer(d.turns, 0, 9) || d.board.filter(n => n !== null).length !== d.turns || (d.turns === 9 && d.selected !== null)) return false;
    return s.status === (d.turns === 9 ? 'completed' : 'playing');
  }
  function record(s) {
    if (!valid(s) || s.status === 'playing') return null;
    return { schema: SCHEMA, id: s.id, game: s.game, ruleVersion: s.ruleVersion, finishedAt: s.finishedAt,
      elapsedMs: Math.max(0, s.finishedAt - s.startedAt), ...result(s) };
  }
  function validRecord(r) {
    if (!r || r.schema !== SCHEMA || typeof r.id !== 'string' || !r.id || r.id.length > 160 || !Object.hasOwn(GAMES, r.game) || ![GAMES[r.game].version, ...(r.game === 'reverse' ? [VERSION] : [])].includes(r.ruleVersion) || r.terminal !== true || !Number.isFinite(r.finishedAt) || !Number.isFinite(r.elapsedMs) || r.elapsedMs < 0) return false;
    if (r.game === 'code') return ['won', 'lost'].includes(r.outcome) && integer(r.attempts, 1, 8) && r.score === (r.outcome === 'won' ? 1000 - 100 * (r.attempts - 1) : 0) && (r.outcome !== 'lost' || r.attempts === 8);
    if (r.game === 'reverse') {
      if (r.ruleVersion !== VERSION) {
        if (!['free', 'challenge'].includes(r.mode) || (r.mode === 'free' ? r.difficulty !== null : !Object.hasOwn(LEVELS, r.difficulty)) || !integer(r.minimumMoves, 1, 7) || (r.outcome === 'won' && r.moves < r.minimumMoves)) return false;
        if (r.mode === 'free') return r.outcome === 'won' && integer(r.moves, 1, 1000000) && r.score === null && r.stars === 0;
        const band = LEVELS[r.difficulty]; if (r.minimumMoves < band.min || r.minimumMoves > band.max) return false;
      }
      return ['won', 'lost'].includes(r.outcome) && integer(r.moves, 1, 25) && r.score === null && r.stars === (r.outcome === 'won' ? (r.moves <= 10 ? 3 : r.moves <= 16 ? 2 : 1) : 0) && (r.outcome !== 'lost' || r.moves === 25);
    }
    return r.outcome === 'completed' && r.turns === 9 && integer(r.score, 9, 120);
  }
  const api = { SCHEMA, VERSION, GAMES, LEVELS, TARGET, create, legalActions, apply, result, valid, record, validRecord, clues, mask, solution, diceScore, reverseSettings };
  if (typeof module !== 'undefined') module.exports = api;
  root.SoloCore = api;
})(typeof window === 'undefined' ? globalThis : window);
