const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4191', out = process.env.SOLO_TEST_OUTPUT || __dirname;
let browser;
(async () => {
  fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const p = await browser.newPage({ reducedMotion: 'reduce' }), errors = [], rows = []; p.on('pageerror', e => errors.push(e.message));
  for (const width of [2400, 2133, 1920, 1745, 1536, 1440, 1280, 1101, 1024, 900, 768, 720, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    for (const route of ['index.html', 'code-breaker.html', 'lights.html', 'dice-strategy.html', 'number-chain.html', 'line-control.html', 'chess.html']) {
      await p.goto(base + '/' + route); assert.equal(await p.locator('#guest-dialog').isVisible(), false, 'No mandatory guest gate in single/local play');
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflow at ' + width);
      const data = await p.evaluate(() => { const board = document.querySelector('.reverse-board,.line-board,.dice-board,.chain-offer,#chess-board'), r = board?.getBoundingClientRect(); return { boardTop: r?.top, boardBottom: r?.bottom }; }); rows.push({ width, route, ...data });
      if (route === 'index.html' && width >= 1101) {
        assert(await p.evaluate(() => { const a = document.querySelector('.haru-ad').getBoundingClientRect(), n = document.querySelector('.home-header').getBoundingClientRect(), m = document.querySelector('.home-content').getBoundingClientRect(), h = document.querySelector('.masthead').getBoundingClientRect(); return a.left >= 0 && a.right <= m.left && n.left >= m.right && n.right <= innerWidth && a.top >= h.bottom && n.top >= h.bottom; }), 'Rails fit outside content and below hero at ' + width);
      }
      if (width === 390 || width === 320 && route === 'chess.html' || width === 1920 && route === 'index.html') await p.screenshot({ path: path.join(out, route.replace('.html', '') + '-' + width + '.png'), fullPage: true });
    }
  }
  await p.goto(base + '/index.html'); await p.locator('.home-header nav').getByRole('button', { name: '내 기록', exact: true }).click(); assert.equal(await p.locator('.all-game-records .record-summary').count(), 5); assert.equal(await p.locator('.suite-record-link').count(), 0); await p.locator('#modal .close').click();
  await p.getByRole('button', { name: '트리플 코드 바로 플레이', exact: true }).click();if(await p.locator('#triple-practice[open]').count())await p.locator('[data-practice-challenge]').click(); assert(await p.locator('#content .triple-symbol').count() >= 9); assert(await p.locator('#content .triple .tile').evaluateAll(es=>es.every(e=>{const ys=[...e.querySelectorAll('svg')].map(s=>s.getBoundingClientRect().top);return Math.max(...ys)-Math.min(...ys)<1;})), 'Card symbols must fit in one row'); await p.screenshot({ path: path.join(out, 'triple-symbols-320.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = { passed: true, base, layouts: rows.length, widths: [...new Set(rows.map(r => r.width))], equivalentDesktopZoomWidths: '1920 CSS viewport at 80/90/100/110/125/150 percent corresponds to 2400/2133/1920/1745/1536/1280 CSS pixels; actual browser zoom UI not driven', noOverflow: true, railsAndHeroBoundary: true, singlePlayerWithoutMandatoryGuest: true, unifiedHomeRecords: true, rows, errors };
  fs.writeFileSync(path.join(out, 'responsive-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ ...result, rows: undefined })); await browser.close();
})().catch(async e => { console.error(e); await browser?.close(); process.exitCode = 1; });
