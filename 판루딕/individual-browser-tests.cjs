'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const C = require('./dist/solo-core.js');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4190', out = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
const games = { code: { title: '코드 브레이커', route: 'code-breaker.html' }, reverse: { title: '불빛 뒤집기', route: 'lights.html' }, dice: { title: '전략 주사위', route: 'dice-strategy.html' } };
let browser;
async function main() {
  fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => { if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_individual-review', nickname: '화면검수' })); });
  const state = game => page.evaluate(game => JSON.parse(localStorage.getItem(`panludiq.solo.${game}.session.v1`)), game);
  const records = () => page.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.records.v1') || '[]'));
  async function launch(game) {
    await page.goto(base + '/index.html#games');
    await page.getByRole(game === 'reverse' ? 'button' : 'link', { name: games[game].title + ' 바로 플레이', exact: true }).click();
    await page.waitForURL('**/' + games[game].route); await page.locator('#game-title').waitFor();
    assert.equal(await page.locator('#game-title').innerText(), games[game].title); assert.equal(await page.locator('.game-tabs').count(), 0);
    assert.equal(await page.locator('body').getAttribute('data-solo-game'), game === 'reverse' ? 'lights' : game);
  }
  // The original individual popups remain on the home page.
  for (const [title, heading] of [['숫자야구', '숫자야구'], ['트리플 코드', '트리플 코드'], ['기억의 짝', '기억의 짝']]) {
    await page.goto(base + '/index.html#games'); await page.getByRole('button', { name: title + ' 바로 플레이', exact: true }).click();
    assert(await page.locator('#modal').isVisible()); assert((await page.locator('#content h2').innerText()).includes(heading)); assert(page.url().includes('index.html'));
    await page.locator('#modal .close').click();
  }
  await launch('code'); const firstCode = await state('code');
  await page.screenshot({ path: path.join(out, 'individual-code-desktop.png'), fullPage: true });
  await page.locator('#code-guess').fill(firstCode.data.secret); await page.locator('#code-form button[type=submit]').click(); assert.equal((await state('code')).status, 'won');
  const codeRecord = (await records())[0]; await page.reload(); assert.equal((await state('code')).status, 'won'); assert.deepEqual(await records(), [codeRecord]);
  await launch('code'); const newCode = await state('code'); assert.notEqual(newCode.id, firstCode.id); assert.equal(newCode.status, 'playing'); assert.equal(newCode.data.attempts.length, 0); assert.equal(await page.locator('.result-band').count(), 0);
  const wrong = newCode.data.secret === '0123' ? '4567' : '0123'; await page.locator('#code-guess').fill(wrong); await page.locator('#code-form button[type=submit]').click();
  const codeProgress = await state('code'); await launch('code'); assert.deepEqual(await state('code'), codeProgress); await page.reload(); assert.deepEqual(await state('code'), codeProgress);
  await launch('reverse'); await page.locator('#lights-mode').selectOption('challenge'); await page.locator('#lights-level').selectOption('hard'); const lights = await state('reverse');
  await page.screenshot({ path: path.join(out, 'individual-lights-desktop.png'), fullPage: true });
  const solution = C.solution(lights.data.board); for (let i = 0; i < 16; i++) if (solution & 1 << i) await page.locator(`[data-press="${i}"]`).click();
  assert.equal((await state('reverse')).status, 'won'); await page.reload(); assert.equal((await state('reverse')).status, 'won');
  await launch('reverse'); const newLights = await state('reverse'); assert.equal(newLights.status, 'playing'); assert.notEqual(newLights.id, lights.id); assert.equal(newLights.data.mode, 'challenge'); assert.equal(newLights.data.difficulty, 'hard'); assert.equal(newLights.data.moves, 0);
  await launch('dice'); await page.screenshot({ path: path.join(out, 'individual-dice-desktop.png'), fullPage: true });
  for (let i = 0; i < 9; i++) { await page.locator(`[data-select="${i % 2}"]`).click(); await page.locator(`[data-place="${i}"]`).click(); }
  const dice = await state('dice'); assert.equal(dice.status, 'completed'); await page.reload(); assert.equal((await state('dice')).status, 'completed');
  await launch('dice'); const newDice = await state('dice'); assert.notEqual(newDice.id, dice.id); assert.equal(newDice.status, 'playing'); assert.equal(newDice.data.turns, 0);
  const allRecords = await records(); assert.equal(allRecords.length, 3); assert(allRecords.some(r => r.id === codeRecord.id));
  for (const [alias, game] of [['code', 'code'], ['reverse', 'reverse'], ['lights', 'reverse'], ['dice', 'dice']]) {
    const before = await state(game); await page.goto(base + `/solo.html?game=${alias}`); await page.waitForURL('**/' + games[game].route); await page.locator('#game-title').waitFor();
    assert.deepEqual(await state(game), before); assert.equal(await page.locator('.game-tabs').count(), 0);
  }
  await page.goto(base + '/solo.html?game=code&records=1'); await page.locator('#solo-records').waitFor({ state: 'visible' });
  assert(!new URL(page.url()).searchParams.has('records')); assert.deepEqual(await records(), allRecords);
  await page.locator('[data-close="solo-records"]').click(); await page.reload(); await page.locator('#code-guess').waitFor(); assert(!await page.locator('#solo-records').isVisible());
  for (const game of Object.keys(games)) {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/' + games[game].route); await page.locator('#game-title').waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, `individual-${game}-mobile.png`), fullPage: true });
    await page.setViewportSize({ width: 320, height: 740 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(await records(), allRecords);
  const blocked = await browser.newContext();
  const initial = C.create('code', { seed: 17, id: 'unrecorded-completion' }), terminal = C.apply(initial, { type: 'guess', value: initial.data.secret }).state;
  await blocked.addInitScript(s => {
    localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_storage-review', nickname: '저장검수' }));
    localStorage.setItem('panludiq.solo.code.session.v1', JSON.stringify(s));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'panludiq.solo.records.v1') throw new DOMException('quota', 'QuotaExceededError'); return original.call(this, key, value); };
  }, terminal);
  const denied = await blocked.newPage(); denied.on('pageerror', e => errors.push(e.message));
  await denied.goto(base + '/code-breaker.html'); await denied.locator('.result-band').waitFor();
  assert(await denied.locator('#save-warning').isVisible());
  assert.equal(await denied.evaluate(() => JSON.parse(localStorage.getItem('panludiq.solo.code.session.v1')).id), terminal.id);
  assert.equal(await denied.evaluate(() => localStorage.getItem('panludiq.solo.records.v1')), null);
  await blocked.close(); assert.deepEqual(errors, []);
  const result = { passed: true, site: base, dedicatedRoutes: Object.values(games).map(g => g.route), noGameSwitchTabs: true, originalPopupsPreserved: true, completedFreshOpenStartsNew: true, resultReloadPreserved: true, unfinishedReopenAndReloadPreserved: true, oldLinksRedirect: true, recordDeepLinkConsumed: true, storageFailureKeepsUnrecordedResult: true, recordCount: allRecords.length, mobileWidths: [390, 320], errors };
  fs.writeFileSync(path.join(out, 'individual-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); await browser.close();
}
main().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
