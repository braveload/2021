'use strict';
// Uses an already installed Playwright module; no dependency installation.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const C = require('./dist/solo-core.js');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4189';
const output = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
fs.mkdirSync(output, { recursive: true });
let browser;
async function run() {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_browser-test', nickname: '검수' }));
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const session = async game => page.evaluate(game => JSON.parse(localStorage.getItem(`panludiq.solo.${game}.session.v1`)), game);
  const rows = async () => page.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.records.v1') || '[]'));
  const checkWidth = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow');
  await page.goto(base + '/index.html');
  assert.equal(await page.locator('.suite-feature').count(), 3);
  await page.getByRole('button', { name: '숫자야구 바로 플레이' }).click();
  await page.locator('#baseball-guess').fill('037');
  await page.getByRole('button', { name: '던지기 →' }).click();
  assert((await page.locator('#content').innerText()).includes('1/10') || (await page.locator('#content').innerText()).includes('정답'));
  // Save existing raw records and verify the new suite never changes them.
  await page.evaluate(() => { localStorage.setItem('panludiq.baseball.v1', '[{"length":3,"attempts":3,"won":true,"time":"2026-11-03T00:00:00.000Z"}]'); localStorage.setItem('panludiq.lights.v1', '[{"moves":8,"time":"2026-11-03T00:00:00.000Z"}]'); });
  const legacy = await page.evaluate(() => [localStorage.getItem('panludiq.baseball.v1'), localStorage.getItem('panludiq.lights.v1')]);
  await page.goto(base + '/solo.html?game=code');
  await checkWidth(); const code = await session('code');
  await page.locator('#code-guess').fill('0012'); await page.locator('#code-form button[type=submit]').click();
  assert.equal((await session('code')).data.attempts.length, 0); assert((await page.locator('#move-message').innerText()).includes('서로 다른'));
  let wrong = '0123'; if (code.data.secret === wrong) wrong = '4567';
  await page.locator('#code-guess').fill(wrong); await page.locator('#code-form button[type=submit]').click();
  assert.equal((await session('code')).data.attempts.length, 1);
  await page.reload(); assert.equal((await session('code')).id, code.id); assert.equal((await session('code')).data.attempts.length, 1);
  await page.locator('#code-guess').fill(code.data.secret); await page.locator('#code-form button[type=submit]').click();
  assert.equal((await session('code')).status, 'won'); assert((await page.locator('.result-band').innerText()).includes('900점'));
  assert.equal((await rows()).length, 1); await page.reload(); assert.equal((await rows()).length, 1);
  // Eighth-attempt failure through UI, no terminal replays counted twice.
  await page.locator('#new-game').click(); const secret2 = (await session('code')).data.secret;
  const guesses = [];
  for (let i = 0; i < 8888 && guesses.length < 8; i++) {
    const g = String(i).padStart(4, '0'); if (/^[0-7]{4}$/.test(g) && new Set(g).size === 4 && g !== secret2) guesses.push(g);
  }
  for (const guess of guesses) { await page.locator('#code-guess').fill(guess); await page.locator('#code-form button[type=submit]').click(); }
  assert.equal((await session('code')).status, 'lost'); assert.equal((await rows()).length, 2);
  await page.goto(base + '/solo.html?game=reverse');
  let reverse = await session('reverse'); const initial = JSON.stringify(reverse);
  await page.locator('#new-game').click(); await page.locator('#cancel-new').click(); assert.equal(JSON.stringify(await session('reverse')), initial);
  const solution = C.solution(reverse.data.board), presses = Array.from({ length: 16 }, (_, i) => i).filter(i => solution & 1 << i);
  await page.locator(`[data-press="${presses[0]}"]`).click(); await page.reload(); assert.equal((await session('reverse')).data.moves, 1);
  for (const i of presses.slice(1)) await page.locator(`[data-press="${i}"]`).click();
  assert.equal((await session('reverse')).status, 'won'); assert.equal((await rows()).length, 3);
  await page.goto(base + '/solo.html?game=dice');
  await page.locator('[data-place="0"]').click(); assert.equal((await session('dice')).data.turns, 0);
  await page.locator('[data-select="1"]').click(); const selected = await session('dice');
  await page.reload(); assert.deepEqual((await session('dice')).data, selected.data); assert.equal((await session('dice')).rng, selected.rng);
  await page.locator('[data-place="0"]').click(); assert.equal((await session('dice')).data.board[0], selected.data.pair[1]);
  const other = await context.newPage(); other.on('pageerror', e => errors.push(e.message));
  await other.goto(base + '/solo.html?game=dice'); await other.locator('[data-select="0"]').click(); await other.locator('[data-place="1"]').click();
  await page.waitForFunction(() => document.querySelector('.play-status')?.textContent.includes('2 / 9'));
  assert.equal((await session('dice')).data.turns, 2); await other.close();
  await page.screenshot({ path: path.join(output, 'desktop-dice.png'), fullPage: true });
  for (let i = 2; i < 9; i++) { await page.locator(`[data-select="${i % 2}"]`).click(); await page.locator(`[data-place="${i}"]`).click(); }
  const complete = await session('dice'); assert.equal(complete.status, 'completed'); assert.equal((await rows()).length, 4);
  assert((await page.locator('.result-value').innerText()).includes(String(C.diceScore(complete.data.board).total)));
  await page.locator('#open-records').click(); assert.equal(await page.locator('.record-summary').count(), 3); assert.equal(await page.locator('.suite-record').count(), 4);
  await page.locator('[data-close="solo-records"]').click(); await page.reload(); assert.equal((await rows()).length, 4);
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('panludiq.baseball.v1'), localStorage.getItem('panludiq.lights.v1')]), legacy);
  await page.goto(base + '/index.html'); await page.getByRole('button', { name: '내 기록', exact: true }).first().click();
  assert(await page.locator('.suite-record-link').isVisible()); await page.locator('.suite-record-link').click();
  await page.locator('#solo-records').waitFor({ state: 'visible' }); assert(await page.locator('#solo-records').isVisible()); await page.locator('[data-close="solo-records"]').click();
  // Mobile layouts, keyboard movement and complete history persist across games.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const game of ['code', 'reverse', 'dice']) {
    await page.goto(base + `/solo.html?game=${game}`); await page.locator('#new-game').click();
    await checkWidth(); assert(await page.locator('[data-game-link="code"]').isVisible());
    await page.locator('#open-rules').click(); assert(await page.locator('#rules-heading').isVisible()); await page.locator('[data-close="solo-rules"]').click();
    if (game === 'reverse') { await page.locator('[data-press="0"]').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.press), '1'); }
    await page.screenshot({ path: path.join(output, `mobile-${game}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(base + '/solo.html?game=code'); await checkWidth();
  await page.goto(base + '/index.html'); await checkWidth(); await page.screenshot({ path: path.join(output, 'mobile-home.png'), fullPage: true });
  // Local storage denied: game still accepts legitimate input and warns visibly.
  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blocked.addInitScript(() => {
    localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_denied', nickname: '검수' }));
    Storage.prototype.setItem = function () { throw new DOMException('denied', 'QuotaExceededError'); };
  });
  const denied = await blocked.newPage(); denied.on('pageerror', e => errors.push(e.message)); await denied.goto(base + '/solo.html?game=dice');
  assert(await denied.locator('#save-warning').isVisible()); await denied.locator('[data-select="0"]').click(); await denied.locator('[data-place="0"]').click();
  assert((await denied.locator('.play-status').innerText()).includes('1 / 9')); await blocked.close();
  // Corrupt sessions/records are not silently counted and legacy data survives.
  await page.goto(base + '/solo.html?game=code');
  await page.evaluate(() => { localStorage.setItem('panludiq.solo.code.session.v1', '{broken'); });
  await page.reload(); assert(await page.locator('#save-warning').isVisible());
  assert.equal(await page.evaluate(() => localStorage.getItem('panludiq.solo.code.session.v1.backup')), '{broken');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('panludiq.baseball.v1'), localStorage.getItem('panludiq.lights.v1')]), legacy);
  assert.deepEqual(errors, []);
  await browser.close();
  const report = { passed: true, browser: 'Chromium', checks: ['home entries/legacy baseball', 'code validation/win/loss/history dedupe', 'reverse legal solution and resume', 'dice selection/reload/nine turns/scoring', 'cross-tab state', 'shared records and legacy isolation', '390px/320px no overflow', 'keyboard grid', 'storage denied/corrupt backup'], screenshots: fs.readdirSync(output).filter(x => x.endsWith('.png')) };
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
run().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
