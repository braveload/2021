'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const C = require('./dist/solo-core.js');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4190';
const out = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
let browser;
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => { if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_lights-review', nickname: '통합검수' })); });
  page.setDefaultTimeout(15000);
  await page.goto(base + '/index.html');
  assert.equal(await page.locator('.game-card.lights').count(), 1); assert.equal(await page.locator('.suite-feature.reverse').count(), 0);
  assert.equal(await page.locator('.suite-feature').count(), 2);
  await page.getByRole('button', { name: '불빛 뒤집기 바로 플레이' }).click(); await page.waitForURL('**/solo.html?game=lights');
  await page.locator('#lights-mode').waitFor(); assert.equal(await page.locator('#lights-mode').inputValue(), 'free'); assert(await page.locator('#lights-level').isDisabled());
  const load = () => page.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.reverse.session.v1')));
  const records = () => page.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.records.v1') || '[]'));
  // Real old-format in-progress save and distinct old completion record, no migration.
  let old = C.create('reverse', { seed: 98, now: 1000, id: 'legacy-progress' }); old.ruleVersion = '1.0.0';
  delete old.data.mode; delete old.data.difficulty; delete old.data.minimumMoves;
  old = C.apply(old, { type: 'press', index: 0 }, 1500).state;
  const oldRecord = { schema: 1, id: 'legacy-record', game: 'reverse', ruleVersion: '1.0.0', finishedAt: 2000, elapsedMs: 1000, terminal: true, outcome: 'won', score: null, moves: 7, stars: 3 };
  const freeRaw = '[{"moves":8,"time":"2026-11-03T00:00:00.000Z"}]', oldRows = JSON.stringify([oldRecord]);
  await page.evaluate(({ old, oldRows, freeRaw }) => { localStorage.setItem('panludiq.solo.reverse.session.v1', JSON.stringify(old)); localStorage.setItem('panludiq.solo.records.v1', oldRows); localStorage.setItem('panludiq.lights.v1', freeRaw); }, { old, oldRows, freeRaw });
  await page.goto(base + '/solo.html?game=reverse'); await page.waitForURL('**/solo.html?game=lights');
  await page.locator('#lights-mode').waitFor(); assert.equal(await page.locator('#game-title').innerText(), '불빛 뒤집기');
  assert.deepEqual(await load(), old); assert.equal(await page.locator('#lights-level').inputValue(), 'legacy');
  assert.equal(await page.evaluate(() => localStorage.getItem('panludiq.solo.records.v1')), oldRows);
  await page.locator('#open-records').click(); assert((await page.locator('#record-summary').innerText()).includes('난이도 미분류')); assert.equal(await page.locator('.legacy-light-record').count(), 1); await page.locator('[data-close="solo-records"]').click();
  // Changing difficulty asks first and cancellation restores the displayed setting.
  await page.locator('#lights-level').selectOption('normal'); await page.locator('#solo-confirm').waitFor({ state: 'visible' });
  await page.locator('#cancel-new').click(); assert.deepEqual(await load(), old); assert.equal(await page.locator('#lights-level').inputValue(), 'legacy');
  await page.locator('#lights-level').selectOption('hard'); await page.locator('#confirm-new').click();
  let hard = await load(); assert.equal(hard.ruleVersion, '1.1.0'); assert.equal(hard.data.difficulty, 'hard'); assert(hard.data.minimumMoves >= 6 && hard.data.minimumMoves <= 7);
  const p = C.solution(hard.data.board), indices = Array.from({ length: 16 }, (_, i) => i).filter(i => p & 1 << i);
  await page.locator(`[data-press="${indices[0]}"]`).click(); const current = await load(); await page.reload(); assert.deepEqual(await load(), current); assert.equal(await page.locator('#lights-level').inputValue(), 'hard');
  await page.locator('#lights-level').selectOption('easy'); await page.keyboard.press('Escape'); assert.deepEqual(await load(), current); assert.equal(await page.locator('#lights-level').inputValue(), 'hard');
  await page.locator('#lights-mode').selectOption('free'); await page.locator('#confirm-new').click(); assert.equal((await load()).data.mode, 'free');
  // Free mode really remains playable after25; repeatedly toggling a non-solution bit.
  let free = await load(); const index = C.solution(free.data.board) === 1 ? 1 : 0;
  for (let i = 0; i < 26; i++) await page.locator(`[data-press="${index}"]`).click();
  assert.equal((await load()).status, 'playing'); assert.equal((await load()).data.moves, 26);
  let solution = C.solution((await load()).data.board);
  for (let i = 0; i < 16; i++) if (solution & 1 << i) await page.locator(`[data-press="${i}"]`).click();
  assert.equal((await load()).status, 'won'); assert(!(await page.locator('.result-value').innerText()).includes('★'));
  for (const level of ['easy', 'normal', 'hard']) {
    if ((await page.locator('#lights-mode').inputValue()) === 'free') await page.locator('#lights-mode').selectOption('challenge');
    if ((await page.locator('#lights-level').inputValue()) !== level) await page.locator('#lights-level').selectOption(level);
    if (await page.locator('#solo-confirm').isVisible()) await page.locator('#confirm-new').click();
    const s = await load(), band = C.LEVELS[level]; assert.equal(s.data.difficulty, level); assert(s.data.minimumMoves >= band.min && s.data.minimumMoves <= band.max);
    solution = C.solution(s.data.board);
    for (let i = 0; i < 16; i++) if (solution & 1 << i) await page.locator(`[data-press="${i}"]`).click();
    assert.equal((await load()).status, 'won'); assert((await records()).some(r => r.ruleVersion === '1.1.0' && r.difficulty === level && r.outcome === 'won'));
  }
  // Construct a seven-move puzzle, then take18 redundant legal moves before solving.
  let exact; for (let seed = 1; seed < 2000; seed++) { const s = C.create('reverse', { seed: seed * 9187, mode: 'challenge', difficulty: 'hard', id: 'exact25', now: 3000 }); if (s.data.minimumMoves === 7) { exact = s; break; } }
  assert(exact); await page.evaluate(s => localStorage.setItem('panludiq.solo.reverse.session.v1', JSON.stringify(s)), exact); await page.reload();
  for (let i = 0; i < 18; i++) await page.locator('[data-press="0"]').click();
  solution = C.solution((await load()).data.board);
  for (let i = 0; i < 16; i++) if (solution & 1 << i) await page.locator(`[data-press="${i}"]`).click();
  assert.equal((await load()).status, 'won'); assert.equal((await load()).data.moves, 25);
  await page.locator('#new-game').click();
  const losing = await load(), repeat = C.solution(losing.data.board) === 1 ? 1 : 0;
  for (let i = 0; i < 25; i++) await page.locator(`[data-press="${repeat}"]`).click();
  assert.equal((await load()).status, 'lost'); const completedRows = await records(); await page.reload(); assert.deepEqual(await records(), completedRows);
  assert.equal(await page.evaluate(() => localStorage.getItem('panludiq.lights.v1')), freeRaw);
  assert.deepEqual((await records()).find(r => r.id === oldRecord.id), oldRecord);
  await page.locator('#open-records').click(); assert.equal(await page.locator('.legacy-light-record').count(), 1); const text = await page.locator('#record-summary').innerText();
  for (const phrase of ['자유 모드', '25회 도전 · 쉬움', '25회 도전 · 보통', '25회 도전 · 어려움', '난이도 미분류']) assert(text.includes(phrase));
  await page.screenshot({ path: path.join(out, 'lights-records.png'), fullPage: true }); await page.locator('[data-close="solo-records"]').click();
  await page.locator('#new-game').click(); await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(out, 'lights-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []); const result = { passed: true, url: base, oneHomeEntry: true, freeOver25: true, levels: ['easy', 'normal', 'hard'], cancelAndConfirm: true, reloadKeepsLevel: true, legacySessionAndRecords: true, move25WinAndLoss: true, terminalDeduplication: true, mobileWidths: [390, 320], errors };
  fs.writeFileSync(path.join(out, 'lights-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); await browser.close();
}
main().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
