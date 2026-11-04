'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), C = require('./dist/solo-core.js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4190', out = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
const key = id => `panludiq.solo.${id}.session.v1`;
let browser;
(async () => {
  fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_extra-review', nickname: '추가검수' })); });
  const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + '/index.html');
  await p.evaluate(() => { localStorage.setItem('panludiq.lights.v1', '[{"moves":8,"time":"2026-11-03T00:00:00.000Z"}]'); localStorage.setItem('panludiq.records.v1', '[]'); });
  const legacyBefore = await p.evaluate(() => ({ lights: localStorage.getItem('panludiq.lights.v1'), home: localStorage.getItem('panludiq.records.v1') }));
  assert.equal(await p.locator('.game-card').count(), 8); assert.equal(await p.locator('.card-rules').count(), 8);
  for (const [name, route] of [['숫자 연쇄', 'number-chain.html'], ['라인 컨트롤', 'line-control.html']]) {
    await p.getByRole('button', { name: name + ' 방법 보기', exact: true }).click();
    assert((await p.locator('#game-rules-content').innerText()).includes(name));
    assert.equal(await p.locator('#game-rules-content a').getAttribute('href'), route);
    await p.getByRole('button', { name: '방법 닫기', exact: true }).click();
  }
  const seed = C.create('chain', { seed: 11, now: 1000, id: 'browser-chain' });
  await p.evaluate(({ k, state }) => localStorage.setItem(k, JSON.stringify(state)), { k: key('chain'), state: seed });
  await p.getByRole('link', { name: '숫자 연쇄 바로 플레이', exact: true }).click();
  await p.waitForURL('**/number-chain.html'); await p.waitForFunction(() => document.querySelector('#game-title')?.textContent === '숫자 연쇄');
  assert.equal(await p.locator('#game-title').innerText(), '숫자 연쇄');
  const getState = game => p.evaluate(k => JSON.parse(localStorage.getItem(k)), key(game));
  async function chainMove() {
    const s = await getState('chain'), actions = C.legalActions(s), a = actions[0];
    if (a.type === 'redraw') await p.locator('[data-chain-redraw]').click();
    else { await p.locator(`[data-chain-card="${a.index}"]`).click(); await p.locator(`[data-chain-side="${a.side}"]`).click(); }
  }
  await chainMove(); const partial = await getState('chain'); await p.reload(); assert.deepEqual(await getState('chain'), partial);
  await p.locator('#new-game').click(); await p.locator('#cancel-new').click(); assert.deepEqual(await getState('chain'), partial);
  for (const width of [1280, 390, 320]) { await p.setViewportSize({ width, height: 900 }); assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await p.screenshot({ path: path.join(out, `chain-${width}.png`), fullPage: true }); }
  while ((await getState('chain')).status === 'playing') await chainMove();
  const doneChain = await getState('chain'); assert(C.valid(doneChain)); assert(await p.locator('.result-band').isVisible());
  await p.reload(); assert.deepEqual(await getState('chain'), doneChain);
  await p.locator('#open-records').click(); assert((await p.locator('#record-list').innerText()).includes('숫자 연쇄'));
  await p.getByRole('button', { name: '기록 닫기', exact: true }).click();
  const history = () => p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.records.v1') || '[]'));
  assert.equal((await history()).filter(r => r.id === doneChain.id).length, 1);
  await p.goto(base + '/index.html'); await p.getByRole('link', { name: '숫자 연쇄 바로 플레이', exact: true }).click();
  await p.waitForURL('**/number-chain.html'); await p.waitForFunction(id => JSON.parse(localStorage.getItem('panludiq.solo.chain.session.v1'))?.id !== id, doneChain.id);
  assert.notEqual((await getState('chain')).id, doneChain.id); assert.equal((await getState('chain')).data.turns, 0);
  let line = C.create('line', { seed: 99, now: 1000, id: 'browser-line', starter: 'ai', difficulty: 'normal' });
  await p.evaluate(({ k, state }) => localStorage.setItem(k, JSON.stringify(state)), { k: key('line'), state: line });
  await p.goto(base + '/line-control.html'); await p.waitForFunction(() => JSON.parse(localStorage.getItem('panludiq.solo.line.session.v1')).data.moves.length === 1);
  line = await getState('line'); assert.equal(line.data.moves[0], C.lineAI(C.create('line', { seed: 99, now: 1000, id: 'browser-line', starter: 'ai', difficulty: 'normal' })).index);
  await p.locator('#line-level').selectOption('hard'); assert(await p.locator('#solo-confirm').isVisible()); await p.locator('#cancel-new').click(); assert.equal(await p.locator('#line-level').inputValue(), 'normal');
  await p.reload(); assert.deepEqual(await getState('line'), line);
  for (const width of [1280, 390, 320]) { await p.setViewportSize({ width, height: 900 }); assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await p.locator('.line-cell').count(), 25); await p.screenshot({ path: path.join(out, `line-${width}.png`), fullPage: true }); }
  // Reload with a saved AI turn: the pending reply must execute exactly once.
  const first = C.legalActions(line)[0]; await p.locator(`[data-line-cell="${first.index}"]`).click();
  await p.reload(); await p.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('panludiq.solo.line.session.v1')); return s.data.moves.length === 3 && s.data.turn === 1; });
  while ((await getState('line')).status === 'playing') {
    line = await getState('line'); if (line.data.turn === 1) await p.locator(`[data-line-cell="${C.legalActions(line)[0].index}"]`).click();
    await p.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('panludiq.solo.line.session.v1')); return s.status !== 'playing' || s.data.turn === 1; });
  }
  const doneLine = await getState('line'); assert(C.valid(doneLine)); assert.equal(doneLine.data.moves.length, 20);
  await p.reload(); assert.deepEqual(await getState('line'), doneLine); assert.equal((await history()).filter(r => r.id === doneLine.id).length, 1);
  await p.locator('#open-records').click(); assert((await p.locator('#record-summary').innerText()).includes('AI 선공')); await p.getByRole('button', { name: '기록 닫기', exact: true }).click();
  assert.deepEqual(await p.evaluate(() => ({ lights: localStorage.getItem('panludiq.lights.v1'), home: localStorage.getItem('panludiq.records.v1') })), legacyBefore);
  await p.goto(base + '/code-breaker.html'); await p.locator('#open-rules').click(); assert((await p.locator('#rules-list').innerText()).includes('0~7'));
  assert.deepEqual(errors, []);
  const result = { passed: true, base, games: ['chain', 'line'], homepageCards: 8, widths: [1280, 390, 320], rulesAndNavigation: true, fullGamesAndReloads: true, pendingAITurnRestoredOnce: true, recordsDeduplicated: true, oldRecordsUnchanged: true, errors };
  fs.writeFileSync(path.join(out, 'extra-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); await browser.close();
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
