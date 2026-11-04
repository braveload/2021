'use strict';
const assert = require('node:assert/strict'), C = require('./dist/solo-core.js'), Store = require('./dist/solo-store.js');
const options = { seed: 1234, now: 1000, id: 'test' };
assert.equal(C.lineWindows.length, 48);
assert.equal(new Set(C.lineWindows.map(x => x.join(','))).size, 48);
assert(C.connects(0, 8)); assert(C.connects(0, 10)); assert(!C.connects(0, 11)); assert(!C.connects(8, 9));
let board = Array(25).fill(0); [0, 1, 2, 3].forEach(i => board[i] = 1);
assert.equal(C.lineScore(board)[0].linePoints, 6);
board[4] = 1; assert.equal(C.lineScore(board)[0].linePoints, 9);
board = Array(25).fill(0); [6, 7, 8, 2, 12].forEach(i => board[i] = 1);
assert(C.lineScore(board)[0].lines.length >= 2); assert.equal(C.lineScore(board)[0].center, 4);
let full = 0, blocked = 0, redraws = 0;
for (let seed = 1; seed <= 1000; seed++) {
  let s = C.create('chain', { ...options, seed });
  while (s.status === 'playing') {
    assert(C.valid(s));
    const all = [...s.data.chain, ...s.data.offer, ...s.data.deck, ...s.data.discarded];
    assert.equal(all.length, 36); assert.equal(new Set(all).size, 36);
    const actions = C.legalActions(s), before = JSON.stringify(s);
    assert(C.apply(s, { type: 'place', index: -1, side: 'right' }).error); assert.equal(JSON.stringify(s), before);
    const action = actions[(seed + s.revision) % actions.length];
    if (action.type === 'redraw') { assert.equal(actions.length, 1); redraws++; }
    else assert(C.apply(s, { type: 'redraw' }).error);
    const next = C.apply(s, action, 2000 + s.revision).state;
    assert.equal(next.data.turns, s.data.turns + (action.type === 'redraw' ? 0 : 1)); s = next;
  }
  assert(C.valid(s)); assert(C.validRecord(C.record(s)));
  assert.equal(C.legalActions(s).length, 0); assert(C.apply(s, { type: 'redraw' }).error);
  if (s.status === 'completed') { full++; assert.equal(s.data.turns, 12); } else { blocked++; assert.equal(s.data.redraws, 0); }
  const corrupt = structuredClone(s); corrupt.data.score++; assert(!C.valid(corrupt));
  assert.deepEqual(C.create('chain', { ...options, seed }), C.create('chain', { ...options, seed }));
}
assert(full && blocked && redraws);
let aiGames = 0; const report = {};
for (const difficulty of ['easy', 'normal', 'hard']) for (const starter of ['human', 'ai']) {
  let wins = 0, draws = 0, losses = 0;
  for (let seed = 1; seed <= 24; seed++) {
    let s = C.create('line', { ...options, seed, difficulty, starter });
    while (s.status === 'playing') {
      assert(C.valid(s)); const before = JSON.stringify(s);
      const actions = C.legalActions(s), action = s.data.turn === 2 ? C.lineAI(s) : actions[(seed * 7 + s.revision * 3) % actions.length];
      assert.equal(JSON.stringify(s), before); assert(actions.some(x => x.index === action.index));
      s = C.apply(s, action, 2000 + s.revision).state;
      assert(C.apply(s, action).error);
    }
    assert(C.valid(s)); assert.equal(s.data.moves.length, 20); assert.equal(s.data.board.filter(n => n === 1).length, 10); assert.equal(s.data.board.filter(n => n === 2).length, 10);
    assert(C.validRecord(C.record(s))); assert.equal(C.lineAI(s), null);
    const corrupt = structuredClone(s); corrupt.data.board[0] = 3; assert(!C.valid(corrupt));
    if (s.status === 'won') wins++; else if (s.status === 'draw') draws++; else losses++; aiGames++;
  }
  report[difficulty + '/' + starter] = { humanWins: wins, draws, aiWins: losses };
}
// A public two-stone threat must be blocked at the edge by normal/hard AI.
for (const difficulty of ['normal', 'hard']) {
  let s = C.create('line', { ...options, difficulty });
  for (const index of [0, 24, 1]) s = C.apply(s, { type: 'place', index }, 2000).state;
  assert.equal(C.lineAI(s).index, 2);
}
const memory = new Map(), storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) }, store = Store.create(storage);
let legacy = C.create('dice', options); for (let i = 0; i < 9; i++) { legacy = C.apply(legacy, { type: 'select', index: 0 }).state; legacy = C.apply(legacy, { type: 'place', index: i }).state; }
assert(store.save(legacy).ok); const oldRaw = memory.get(store.sessionKey('dice'));
for (const game of ['chain', 'line']) {
  let s = C.create(game, { ...options, id: game });
  while (s.status === 'playing') s = C.apply(s, C.legalActions(s)[0]).state;
  assert(store.save(s).ok); assert(store.save(s).ok); assert.deepEqual(store.load(game).state, s);
}
assert.equal(store.records().rows.length, 3); assert.equal(memory.get(store.sessionKey('dice')), oldRaw);
assert(!store.save({ ...C.create('chain', options), status: 'won' }).ok);
console.log('PASS: two extra engines, 1000 chain games/card conservation/redraw boundaries, 144 complete AI games, line windows/crossings/center/turns, replay validation and deduplicated shared storage');
console.log(JSON.stringify({ chain: { completed: full, blocked, redraws }, aiProbeAgainstScriptedPlacementsOnly: report }));

for(let seed=1;seed<=10000;seed++){const s=C.create('chain',{seed,now:1000});assert(C.legalActions(s).some(a=>a.type==='place'));assert(C.valid(s));}
let old=C.create('chain',{seed:1,now:1000,ruleVersion:'1.0.0'});assert(C.valid(old));while(old.status==='playing')old=C.apply(old,C.legalActions(old)[0]).state;assert(C.valid(old));assert(C.validRecord(C.record(old)));assert.equal(C.record(old).ruleVersion,'1.0.0');
console.log('PASS: 10000 first offers have legal placement; v1.0 sessions/results retain replay compatibility');
