'use strict';
const assert = require('node:assert/strict'), C = require('./dist/solo-core.js'), S = require('./dist/solo-store.js');
const fixed = { seed: 123, now: 1000, id: 'test' };
function step(s, action, now = 2000) {
  const before = JSON.stringify(s), result = C.apply(s, action, now);
  assert.equal(JSON.stringify(s), before, 'input is immutable');
  if (!result.error) assert(C.valid(result.state), `${s.game}: resulting state invalid`);
  return result;
}
const memory = () => {
  const map = new Map();
  return { map, getItem(k) { return map.get(k) ?? null; }, setItem(k, v) { map.set(k, String(v)); }, removeItem(k) { map.delete(k); } };
};
assert.throws(() => C.create('bad'), RangeError);
for (const game of Object.keys(C.GAMES)) {
  const a = C.create(game, fixed), b = C.create(game, fixed);
  assert(C.valid(a)); assert.deepEqual(a, b); assert(C.legalActions(a).length); assert.equal(C.record(a), null);
  assert(!C.valid({ ...a, ruleVersion: 'future' })); assert(!C.valid({ ...a, status: 'won' }));
}
let code = C.create('code', fixed); code.data.secret = '0123';
for (const value of ['', '1123', '0128', '１２３４', 123, null, '0 23', '012']) {
  const r = step(code, { type: 'guess', value }); assert(r.error); assert.equal(r.state, code);
}
assert.deepEqual(C.clues('0123', '1032'), { exact: 0, misplaced: 4 });
assert.deepEqual(C.clues('0123', '4567'), { exact: 0, misplaced: 0 });
assert.deepEqual(C.clues('0123', '0321'), { exact: 2, misplaced: 2 });
let next = step(code, { type: 'guess', value: '4567' }).state;
assert(step(next, { type: 'guess', value: '4567' }).error); assert.equal(next.data.attempts.length, 1);
const guesses = ['4567', '4576', '4657', '4675', '4756', '4765', '5467'];
let last = code; for (const value of guesses) last = step(last, { type: 'guess', value }).state;
const eighthWin = step(last, { type: 'guess', value: '0123' }).state;
assert.equal(eighthWin.status, 'won'); assert.equal(C.result(eighthWin).score, 300);
const eighthLoss = step(last, { type: 'guess', value: '5476' }).state;
assert.equal(eighthLoss.status, 'lost'); assert.equal(C.result(eighthLoss).score, 0);
assert.equal(step(eighthWin, { type: 'guess', value: '0123' }).state, eighthWin);
assert.equal(C.result(step(code, { type: 'guess', value: '0123' }).state).score, 1000);
for (let seed = 1; seed <= 500; seed++) {
  const s = C.create('code', { seed }); assert.equal(new Set(s.data.secret).size, 4); assert.match(s.data.secret, /^[0-7]{4}$/);
  const h = C.clues(s.data.secret, '0367'); assert(h.exact + h.misplaced <= 4);
}
// Independent coordinate implementation and exhaustive 65,536 parity patterns.
function refPress(board, index) {
  const row = Math.floor(index / 4), col = index % 4;
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) if (r >= 0 && r < 4 && c >= 0 && c < 4) board ^= 1 << (r * 4 + c);
  return board;
}
const reachable = new Set();
for (let mask = 0; mask < 65536; mask++) {
  let board = C.TARGET; for (let i = 0; i < 16; i++) if (mask & 1 << i) board = refPress(board, i);
  reachable.add(board);
}
assert.equal(reachable.size, 4096);
for (let i = 0; i < 16; i++) assert.equal(C.mask(i), refPress(0, i));
for (let seed = 1; seed <= 500; seed++) {
  let s = C.create('reverse', { seed }); assert.notEqual(s.data.board, C.TARGET); assert(reachable.has(s.data.board));
  const solution = C.solution(s.data.board); assert.notEqual(solution, undefined);
  for (let i = 0; i < 16; i++) if (solution & 1 << i) s = step(s, { type: 'press', index: i }).state;
  assert.equal(s.status, 'won'); assert.equal(s.data.board, C.TARGET);
}
let boundary = C.create('reverse', fixed); boundary.data.board = C.TARGET ^ C.mask(0); boundary.data.moves = 24;
assert.equal(step(boundary, { type: 'press', index: 0 }).state.status, 'won');
assert.equal(step(boundary, { type: 'press', index: 15 }).state.status, 'lost');
for (const index of [-1, 16, null, 1.5]) assert(step(boundary, { type: 'press', index }).error);
// Scoring expectations calculated from a fixed full board and partial lines.
const board = [1, 4, 5, 3, 5, 6, 5, 3, 2];
assert.deepEqual(C.diceScore(board), { base: 34, rows: [10, 10, 10], columns: [8, 8, 8], diagonals: [0, 6], total: 94 });
assert.deepEqual(C.diceScore([6, 6, null, null, null, null, null, null, null]), { base: 12, rows: [0, 0, 0], columns: [0, 0, 0], diagonals: [0, 0], total: 12 });
assert.deepEqual(C.diceScore([1, 2, 3, 2, 3, 4, 5, 4, 1]).diagonals, [6, 6]);
let dice = C.create('dice', fixed);
assert(step(dice, { type: 'place', index: 0 }).error);
dice = step(dice, { type: 'select', index: 0 }).state;
const rngBefore = dice.rng, pairBefore = dice.data.pair.slice();
dice = step(dice, { type: 'select', index: 1 }).state; assert.equal(dice.rng, rngBefore); assert.deepEqual(dice.data.pair, pairBefore);
dice = step(dice, { type: 'place', index: 0 }).state; assert.equal(dice.data.board[0], pairBefore[1]); assert.equal(dice.data.turns, 1);
dice = step(dice, { type: 'select', index: 0 }).state; assert(step(dice, { type: 'place', index: 0 }).error);
for (let i = 1; i < 9; i++) {
  dice = step(dice, { type: 'select', index: i % 2 }).state;
  const rng = dice.rng; dice = step(dice, { type: 'place', index: i }).state;
  if (i === 8) assert.equal(dice.rng, rng, 'no tenth roll');
}
assert.equal(dice.status, 'completed'); assert.equal(C.result(dice).score, C.diceScore(dice.data.board).total);
assert.equal(C.legalActions(dice).length, 0);
for (let seed = 1; seed <= 300; seed++) {
  let s = C.create('dice', { seed, now: 1000 });
  for (let turn = 0; turn < 9; turn++) {
    s = step(s, { type: 'select', index: turn % 2 }).state;
    const restored = JSON.parse(JSON.stringify(s)), a = { type: 'place', index: turn };
    assert.deepEqual(C.apply(s, a, 2000), C.apply(restored, a, 2000)); s = step(s, a).state;
  }
  assert(C.validRecord(C.record(s)));
}
const storage = memory(), store = S.create(storage);
assert.deepEqual(store.load('code'), { state: null, error: '' });
assert(store.save(eighthWin).ok); assert.deepEqual(store.load('code').state, eighthWin);
assert(store.save(eighthWin).ok); assert.equal(store.records().rows.length, 1, 'terminal idempotency');
assert(store.save(dice).ok); assert.equal(store.records().rows.length, 2); assert.deepEqual(store.load('code').state, eighthWin);
const savedDice = store.load('dice').state; assert.equal(savedDice.rng, dice.rng); assert.deepEqual(savedDice.data.pair, dice.data.pair);
storage.setItem('panludiq.baseball.v1', 'legacy'); storage.setItem('panludiq.lights.v1', 'old lights');
storage.setItem(store.historyKey, '{broken'); assert(store.records().error); assert(store.save({ ...eighthLoss, id: 'code-loss-run' }).ok);
assert.equal(storage.getItem(`${store.historyKey}.backup`), '{broken'); assert.equal(store.records().rows.length, 1);
assert.equal(storage.getItem('panludiq.baseball.v1'), 'legacy'); assert.equal(storage.getItem('panludiq.lights.v1'), 'old lights');
storage.setItem(store.sessionKey('reverse'), '{bad'); assert(store.load('reverse').error);
assert(store.save(C.create('reverse', fixed)).ok); assert.equal(storage.getItem(`${store.sessionKey('reverse')}.backup`), '{bad');
const denied = S.create({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
assert(denied.load('code').error); assert(!denied.save(eighthWin).ok); assert(denied.records().error);
const quota = S.create({ getItem() { return null; }, setItem() { throw Error('quota'); } }); assert(!quota.save(dice).ok);
assert(!store.save({ ...dice, ruleVersion: 'old' }).ok);
const invalidRow = { ...C.record(eighthWin), score: 999999 }; assert(!C.validRecord(invalidRow));
const capped = S.create(memory());
for (let i = 0; i < 105; i++) assert(capped.save({ ...eighthWin, id: `record-${i}` }).ok);
assert.equal(capped.records().rows.length, 100); assert.equal(capped.records().rows[0].id, 'record-104'); assert.equal(capped.records().rows.at(-1).id, 'record-5');
const retentionStorage = memory(), retention = S.create(retentionStorage);
assert(retention.save(eighthWin).ok);
for (let i = 0; i < 100; i++) assert(retention.save({ ...dice, id: `dice-${i}` }).ok);
assert(!retention.records().rows.some(r => r.game === 'code'));
assert(retention.save(eighthWin).ok); assert(!retention.records().rows.some(r => r.game === 'code'), 'old completed session must not reinsert an evicted record');
let failHistory = true; const partialStorage = memory(), ordinarySet = partialStorage.setItem;
partialStorage.setItem = function (key, value) { if (key === S.HISTORY && failHistory) { failHistory = false; throw Error('quota'); } ordinarySet.call(this, key, value); };
const partial = S.create(partialStorage); assert(!partial.save(eighthWin).ok); assert.equal(partial.records().rows.length, 0);
assert(partial.load('code').state); assert(partial.save(eighthWin).ok); assert.equal(partial.records().rows.length, 1); assert(partial.save(eighthWin).ok); assert.equal(partial.records().rows.length, 1);
console.log('PASS: shared 3-game lifecycle, code input/clues/eighth-attempt boundaries; 65,536 reverse patterns/500 generated solutions; dice scoring/300 deterministic runs; isolated sessions, deduped history, corrupt backups and denied/quota storage');
