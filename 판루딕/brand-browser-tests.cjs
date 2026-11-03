'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SOLO_TEST_URL || 'http://127.0.0.1:4190', out = process.env.SOLO_TEST_OUTPUT || path.join(__dirname, 'browser-evidence');
let browser;
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('panludiq.guest.v1')) localStorage.setItem('panludiq.guest.v1', JSON.stringify({ version: 1, id: 'guest_brand-review', nickname: '브랜드검수' })); });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/index.html');
  assert.equal(await page.locator('.brand-motion').count(), 1);
  const alpha = await page.locator('.brand-motion img').evaluate(async img => {
    await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0,0,c.width,c.height).data;
    let white = 0, transparent = 0; for(let i=0;i<d.length;i+=4){if(d[i+3]===0) transparent++; if(Math.min(d[i],d[i+1],d[i+2])>240 && d[i+3]>240) white++;}
    return {corner:d[3], white, transparent, src:img.getAttribute('src')};
  });
  assert.equal(alpha.src, 'assets/logo-transparent-v3.png'); assert.equal(alpha.corner, 0); assert(alpha.white > 1000); assert(alpha.transparent > 10000);

  const motion = await page.locator('.brand-motion img').evaluate(el => ({ name: getComputedStyle(el).animationName, iterations: getComputedStyle(el).animationIterationCount, duration: getComputedStyle(el).animationDuration }));
  assert.equal(motion.name, 'panludiq-logo-arrive'); assert.equal(motion.iterations, '1'); assert.equal(motion.duration, '3.6s');
  await page.locator('.brand-motion img').evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
  assert.equal(await page.locator('.brand-motion img').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.brand-motion img').evaluate(el => el.getAnimations().every(a => a.playState === 'finished')), true);
  await page.locator('.home-header').screenshot({path:path.join(out,'header-desktop.png')});
  assert.equal(await page.locator('.haru-ad').count(), 1);
  const target = page.locator('.haru-ad-link');
  assert.equal(await target.getAttribute('href'), 'https://haru-hankan.onrender.com/');
  assert.equal(await target.getAttribute('target'), '_blank'); assert((await target.getAttribute('rel')).includes('noopener'));
  assert((await target.innerText()).includes('광고')); assert((await target.innerText()).includes('랜딩페이지 · 로고 · 브랜딩'));
  for (const width of [1920, 1600, 1500, 1480, 1366, 1280, 1101]) {
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(() => {const a=document.querySelector('.haru-ad').getBoundingClientRect(), m=document.querySelector('.home-content').getBoundingClientRect();return a.left>=0 && a.right<=m.left && a.top===120 && document.documentElement.scrollWidth<=innerWidth;}), 'Left rail must fit outside content at '+width);
    assert(await page.evaluate(() => {const h=document.querySelector('.home-header').getBoundingClientRect(),m=document.querySelector('.home-content').getBoundingClientRect();return h.left>=m.right && h.right<=innerWidth && h.top===120;}),'Right navigation must fit outside content at '+width);
    await page.evaluate(()=>scrollTo(0,600));
    assert.equal(await page.locator('.haru-ad').evaluate(el=>Math.round(el.getBoundingClientRect().top)),120);
  }
  await page.getByRole('navigation',{name:'주 메뉴'}).getByRole('button',{name:'내 기록',exact:true}).click();
  assert(await page.locator('#modal').isVisible()); await page.locator('#modal .close').click();
  await page.setViewportSize({width:1920,height:1000});
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
    await page.locator('.home-header').screenshot({path:path.join(out,`header-mobile-${width}.png`)});
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
  const result = { passed: true, site: base, originalLogoMotionSeconds: 3.6, finiteMotion: true, reducedMotionStatic: true, desktopLeftRail: true, narrowScreenInFlow: true, destination: 'https://haru-hankan.onrender.com/', externalNewTabNoOpener: true, storageUnchangedByAd: true, mobileWidths: [390, 320], existingPopupAndDedicatedPages: true, errors };
  fs.writeFileSync(path.join(out, 'brand-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); await browser.close();
}
main().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
