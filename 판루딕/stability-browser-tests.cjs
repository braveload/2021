const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4191', out = process.env.SOLO_TEST_OUTPUT || __dirname;
let browser;
(async () => {
  fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }), errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(base); await p.evaluate(() => { localStorage.setItem('panludiq.records.v1', '[]'); localStorage.setItem('panludiq.lights.v1', '[{"moves":8,"time":"2026-11-03T00:00:00.000Z"}]'); });
  const launch = name => p.getByRole('button', { name: name + ' 바로 플레이', exact: true }).click();
  await launch('숫자야구'); await p.locator('#baseball-guess').fill('012'); await p.locator('#baseball-form button').click();
  await p.reload(); assert.equal(await p.locator('#baseball-count').innerText(), '1/10');
  await p.locator('#modal .close').click(); await p.locator('#confirm-accept').click(); await launch('숫자야구'); assert.equal(await p.locator('#baseball-count').innerText(), '1/10');
  await p.locator('#baseball-guess').fill('03'); await p.reload(); assert.equal(await p.locator('#baseball-guess').inputValue(), '03');
  // Complete through public inputs to ensure finishing clears progress without duplicating records.
  for (const guess of ['013', '014', '015', '016', '017', '018', '019', '023', '024']) { if (!await p.locator('#baseball-guess').count()) break; await p.locator('#baseball-guess').fill(guess); await p.locator('#baseball-form button').click(); }
  assert.equal(await p.evaluate(() => localStorage.getItem('panludiq.popup.baseball.v1')), null);
  const count = await p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.baseball.v1') || '[]').length); await p.reload(); assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.baseball.v1') || '[]').length), count);
  await launch('트리플 코드'); await p.locator('.triple .tile').first().click();
  const puzzle = await p.locator('.triple .tile').evaluateAll(es => es.map(e => e.getAttribute('aria-label'))); assert(await p.locator('.triple-symbol pattern').count() > 0);
  await p.locator('#active-rules').click(); const clock = Number(await p.locator('#clock').innerText()); await p.waitForTimeout(2200); assert.equal(Number(await p.locator('#clock').innerText()), clock);
  await p.getByRole('button', { name: '방법 닫기', exact: true }).click(); await p.reload(); assert.deepEqual(await p.locator('.triple .tile').evaluateAll(es => es.map(e => e.getAttribute('aria-label'))), puzzle); assert.equal(await p.locator('.triple .tile[aria-pressed=true]').count(), 1);
  const beforeLeaving = Number(await p.locator('#clock').innerText()); await p.goto(base + '/lights.html'); if (await p.locator('#guest-dialog').isVisible()) await p.locator('#guest-form button').click(); await p.waitForTimeout(2200);
  await p.goto(base); await launch('트리플 코드'); assert(Number(await p.locator('#clock').innerText()) >= beforeLeaving - 1);
  await p.locator('#modal .close').click(); await p.locator('#confirm-accept').click(); await launch('기억의 짝'); await p.locator('.memory .tile').first().click(); const face = await p.locator('.memory .tile').first().innerText(); await p.reload(); assert.equal(await p.locator('.memory .tile').first().innerText(), face);
  await p.locator('#active-rules').click(); const memoryClock = Number(await p.locator('#clock').innerText()); await p.waitForTimeout(2200); assert.equal(Number(await p.locator('#clock').innerText()), memoryClock); await p.getByRole('button', { name: '방법 닫기', exact: true }).click();
  await p.goto(base + '/chess.html'); if (await p.locator('#guest-dialog').isVisible()) await p.locator('#guest-form button').click(); await p.locator('[data-cell="7"]').click(); await p.locator('#chess-board .target,#chess-board .capture').first().click();
  const board = await p.locator('#chess-board').innerText(), moveCount = await p.locator('#count').innerText(); await p.locator('#rotate').click(); const rotated = await p.locator('#chess-board').innerText(); await p.reload(); assert.equal(await p.locator('#chess-board').innerText(), rotated); assert.equal(await p.locator('#count').innerText(), moveCount); assert.notEqual(board, rotated);
  await p.locator('#resign').click(); assert((await p.locator('#turn-info').innerText()).includes('승리')); await p.reload(); assert((await p.locator('#turn-info').innerText()).includes('승리'));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, base, popupReloadAndResume: true, baseballRecordOnce: true, triplePuzzleAndSelectionRestored: true, helpClockPaused: true, outsidePageClockPaused: true, memoryOpenCardRestored: true, localChessMovesHandsRotationAndResultRestored: true, errors })); await browser.close();
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
