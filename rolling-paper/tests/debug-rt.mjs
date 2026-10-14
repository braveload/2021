import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://web:3000';
const b = await chromium.launch();
const mk = async (tag) => {
  const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  p.on('websocket', (ws) => {
    ws.on('framesent', (f) => { if (/postgres_changes|phx_join/.test(f.payload)) console.log(`[${tag}] SENT`, f.payload.slice(0, 600)); });
    ws.on('framereceived', (f) => { if (!/presence|heartbeat/.test(f.payload)) console.log(`[${tag}] RECV`, f.payload.slice(0, 500)); });
  });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${tag}] console`, m.text().slice(0, 300)); });
  return p;
};
const A = await mk('A'), B = await mk('B');
await A.goto(BASE + '/?desktop=1'); await A.waitForSelector('#create-form');
await A.click('#create-form button[type=submit]'); await A.waitForSelector('.topbar');
const code = new URL(A.url()).searchParams.get('b');
await A.keyboard.press('Escape');
await B.goto(`${BASE}/?b=${code}&desktop=1`); await B.waitForSelector('.topbar');
await B.waitForTimeout(2500);
console.log('--- posting ---');
await A.fill('#c-msg', '디버그 글'); await A.click('.composer button[type=submit]');
await B.waitForTimeout(5000);
console.log('B notes:', await B.locator('.board .note').count());
await b.close();
