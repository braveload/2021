const assert = require('node:assert/strict'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4191';
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE }); const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(base); await p.getByRole('button', { name: '트리플 코드 바로 플레이', exact: true }).click();
  for (let round = 1; round <= 6; round++) {
    const answer = await p.evaluate(() => state.puzzle.answer);
    for (const i of answer) await p.locator('.triple .tile').nth(i).click();
    await p.reload(); assert.equal(await p.locator('.triple .tile[aria-pressed=true]').count(), 3);
    await p.locator('#submit').click(); await p.reload();
    if (round < 6) assert.equal(await p.evaluate(() => state.round), round + 1);
  }
  assert((await p.locator('#content h2').innerText()).includes('6라운드 완료'));
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.records.v1')).filter(r => r.id === 'triple').length), 1);
  await p.reload(); assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.records.v1')).filter(r => r.id === 'triple').length), 1);
  await p.getByRole('button', { name: '기억의 짝 바로 플레이', exact: true }).click();
  // Internal fixture knowledge is used only for functional completion verification.
  const pairs = await p.evaluate(() => Array.from({ length: 8 }, (_, n) => state.deck.flatMap((v, i) => v === n ? [i] : [])));
  for (const [a, b] of pairs) {
    await p.locator('.memory .tile').nth(a).click(); await p.reload(); await p.locator('.memory .tile').nth(b).click();
  }
  assert((await p.locator('#content h2').innerText()).includes('8쌍 모두'));
  await p.reload(); assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('panludiq.records.v1')).filter(r => r.id === 'memory').length), 1);
  await p.getByRole('button', { name: '내 기록', exact: true }).first().click(); assert.equal(await p.locator('.all-game-records .record-summary').count(), 5);
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, base, tripleSixRoundTransitionsRestoredOnce: true, memoryEightPairsAcrossReloads: true, completionRecordsOnce: true, homeUnifiedRecords: true, errors })); await browser.close();
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
