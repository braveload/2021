'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4190', out = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
let browser;
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_brand-review', nickname: '브랜드검수' })); });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/index.html');
  assert.equal(await page.locator('.brand-motion').count(), 1);
  const motion = await page.locator('.brand-motion img').evaluate(el => ({ name: getComputedStyle(el).animationName, iterations: getComputedStyle(el).animationIterationCount, duration: getComputedStyle(el).animationDuration }));
  assert.equal(motion.name, 'panludiq-logo-arrive'); assert.equal(motion.iterations, '1'); assert.equal(motion.duration, '3.6s');
  await page.locator('.brand-motion img').evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
  assert.equal(await page.locator('.brand-motion img').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.brand-motion img').evaluate(el => el.getAnimations().every(a => a.playState === 'finished')), true);
  assert.equal(await page.locator('.haru-ad').count(), 1);
  const target = page.locator('.haru-ad-link');
  assert.equal(await target.getAttribute('href'), 'https://haru-hankan.onrender.com/');
  assert.equal(await target.getAttribute('target'), '_blank'); assert((await target.getAttribute('rel')).includes('noopener'));
  assert((await target.innerText()).includes('광고')); assert((await target.innerText()).includes('랜딩페이지 · 로고 · 브랜딩'));
  assert(await page.evaluate(() => document.querySelector('.modes').getBoundingClientRect().bottom <= document.querySelector('.haru-ad').getBoundingClientRect().top));
  assert(await page.evaluate(() => document.querySelector('#game-list').getBoundingClientRect().bottom <= document.querySelector('.haru-ad').getBoundingClientRect().top));
  await target.scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('.haru-ad-brand img')?.naturalWidth > 0);
  await page.screenshot({ path: path.join(out, 'haru-banner-desktop.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('panludiq.lights.v1', '[{"moves":8,"time":"2026-11-03T00:00:00.000Z"}]'));
  const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('panludiq.')).map(k => [k, localStorage.getItem(k)])));
  const popupPromise = page.waitForEvent('popup'); await target.click(); const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded'); assert.equal(new URL(popup.url()).hostname, 'haru-hankan.onrender.com'); assert((await popup.title()).includes('하루한칸'));
  assert(await popup.evaluate(() => window.opener === null)); await popup.close();
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('panludiq.')).map(k => [k, localStorage.getItem(k)]))), before);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto(base + '/index.html'); await target.scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert((await page.locator('.haru-ad-cta').boundingBox()).height >= 44);
    await page.screenshot({ path: path.join(out, `haru-banner-mobile-${width}.png`), fullPage: true });
  }
  await page.goto(base + '/index.html'); await page.getByRole('button', { name: '숫자야구 바로 플레이' }).click(); assert(await page.locator('#modal').isVisible());
  await page.locator('#modal .close').click();
  for (const route of ['code-breaker.html', 'lights.html', 'dice-strategy.html', 'chess.html']) {
    await page.goto(base + '/' + route); assert.equal(await page.locator('.brand-motion').count(), 1); assert.equal(await page.locator('.haru-ad').count(), 0);
    const widthWithMotion = await page.evaluate(() => document.documentElement.scrollWidth);
    if (route === 'chess.html') {
      await page.locator('link[href="brand-motion.css"]').evaluate(el => el.remove());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), widthWithMotion, 'Logo must not increase existing chess width');
    } else assert(widthWithMotion <= 320, route);
  }
  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const staticPage = await reduced.newPage(); staticPage.on('pageerror', e => errors.push(e.message)); await staticPage.goto(base + '/index.html');
  assert.equal(await staticPage.locator('.brand-motion img').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await staticPage.locator('.brand-motion').evaluate(el => getComputedStyle(el, '::after').display), 'none');
  await staticPage.screenshot({ path: path.join(out, 'logo-reduced-motion.png'), fullPage: true }); await reduced.close();
  assert.deepEqual(errors, []);
  const result = { passed: true, site: base, originalLogoMotionSeconds: 3.6, finiteMotion: true, reducedMotionStatic: true, bannerPlacementAfterGamesAndModes: true, destination: 'https://haru-hankan.onrender.com/', externalNewTabNoOpener: true, storageUnchangedByAd: true, mobileWidths: [390, 320], existingPopupAndDedicatedPages: true, errors };
  fs.writeFileSync(path.join(out, 'brand-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); await browser.close();
}
main().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
