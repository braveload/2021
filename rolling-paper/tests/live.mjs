// 실제 Supabase 연결 검증: 서로 다른 브라우저 컨텍스트 2개(= 다른 사용자)로 실시간·하트·사진·비밀모드 확인
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://web:3000';
const SHOTS = process.env.SHOTS_DIR || './shots';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n} ${c ? '' : x}`); };
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { try { if (await fn()) return true; } catch { /* retry */ } if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADq0RJvUJAAAAAElFTkSuQmCC', 'base64');
const problems = [];
const watch = (p, t) => { p.on('pageerror', (e) => problems.push(`[${t}] ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\./.test(m.text())) problems.push(`[${t}] ${m.text()}`); }); };

const browser = await chromium.launch();
const mk = async (tag) => { const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); watch(p, tag); return { c, p }; };
const post = async (p, o) => {
  await p.fill('#c-nick', o.nick); await p.fill('#c-msg', o.msg);
  if (o.photo) { await p.setInputFiles('#c-photo', { name: 'p.png', mimeType: 'image/png', buffer: png }); await p.waitForSelector('.photo-thumb img'); }
  await p.click('.composer button[type=submit]');
};

console.log('\n■ 실시간 (서로 다른 사용자 A/B)');
const A = await mk('A'), B = await mk('B');
await A.p.goto(BASE + '/?desktop=1');
await A.p.waitForSelector('#create-form');
check('실서버 모드(데모 배너 없음)', await A.p.locator('.demo-banner').count() === 0);
await A.p.fill('#f-title', '실서버 검증 보드');
await A.p.click('#create-form button[type=submit]');
await A.p.waitForSelector('.topbar', { timeout: 20000 });
const code = new URL(A.p.url()).searchParams.get('b');
check('서버에 보드 생성됨', /^[a-z0-9]{6}$/.test(code), A.p.url());
await A.p.keyboard.press('Escape');
await B.p.goto(`${BASE}/?b=${code}&desktop=1`);
await B.p.waitForSelector('.topbar', { timeout: 20000 });
check('B(다른 사용자)가 같은 보드를 연다', (await B.p.textContent('#board-title')) === '실서버 검증 보드');
check('Presence: 2명', await until(async () => (await A.p.textContent('.chip:has-text("👀")')).includes('2'), 8000));
check('B 에는 관리자 권한 없음', await B.p.locator('.chip.admin').count() === 0 && await A.p.locator('.chip.admin').count() === 1);

await post(A.p, { nick: '민지', msg: '실서버 첫 글 🎂', photo: true });
check('A 화면에 글 1개', await until(async () => (await A.p.locator('.board .note').count()) === 1, 15000));
check('[실시간] B 화면에 새로고침 없이 도착', await until(async () => (await B.p.locator('.board .note').count()) === 1, 10000));
check('Storage 사진이 B 에서 로드됨', await until(async () => B.p.evaluate(() => { const i = document.querySelector('.board .note.has-photo img'); return !!i && i.complete && i.naturalWidth > 0; }), 10000));
check('A 화면 중복 없음', await A.p.locator('.board .note').count() === 1);

await B.p.locator('.board .note .heart').click();
check('[실시간] B 의 하트가 A 에 반영(1)', await until(async () => (await A.p.locator('.board .note .heart-count').textContent()) === '1', 8000));
await B.p.reload(); await B.p.waitForSelector('.board .note');
check('새로고침 후에도 내 하트 상태 유지', (await B.p.locator('.board .note .heart').getAttribute('aria-pressed')) === 'true');

await A.p.click('.fab', { timeout: 1000 }).catch(() => {});
await A.p.waitForTimeout(3200);
await post(A.p, { nick: '준호', msg: '두 번째 글' });
check('[실시간] 두 번째 글이 B 에 도착', await until(async () => (await B.p.locator('.board .note').count()) === 2, 10000));
await A.p.screenshot({ path: `${SHOTS}/live-A.png` });

A.p.once('dialog', (d) => d.accept());
await A.p.locator('.board .note', { hasText: '두 번째 글' }).locator('.del').click();
check('관리자 삭제(A)', await until(async () => (await A.p.locator('.board .note').count()) === 1, 8000));
check('[실시간] 삭제가 B 에 반영', await until(async () => (await B.p.locator('.board .note').count()) === 1, 8000));

console.log('\n■ 서프라이즈 모드 + 마감 (서버 시계 기준)');
const C = await mk('C'), D = await mk('D');
await C.p.goto(BASE + '/?desktop=1');
await C.p.waitForSelector('#create-form');
const d = new Date(Date.now() + 75000);
const pad = (n) => String(n).padStart(2, '0');
// 분 단위 입력: 다음 분 정각 (최대 60초 + α)
const dl = new Date(Math.ceil((Date.now() + 20000) / 60000) * 60000);
await C.p.fill('#f-deadline', `${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`);
await C.p.check('#f-secret');
await C.p.click('#create-form button[type=submit]');
await C.p.waitForSelector('.topbar', { timeout: 20000 });
const code2 = new URL(C.p.url()).searchParams.get('b');
await C.p.keyboard.press('Escape');
await D.p.goto(`${BASE}/?b=${code2}&desktop=1`);
await D.p.waitForSelector('.topbar', { timeout: 20000 });
await post(D.p, { nick: '서연', msg: '비밀 글입니다' });
await D.p.waitForSelector('.board .note.secret-mine', { timeout: 15000 });
await C.p.waitForTimeout(2500);
check('마감 전: 만든 사람(C)에게도 남의 글이 안 보인다(서버 차단)', await C.p.locator('.board .note').count() === 0);
check('마감 전: 작성자(D)에게는 🔒 로 보인다', await D.p.locator('.lock-tag').count() === 1);
const waitMs = dl.getTime() - Date.now() + 8000;
console.log(`  … 마감까지 대기 ${Math.round(waitMs / 1000)}초`);
const opened = await until(async () => (await C.p.locator('.envelope').count()) === 1, Math.max(waitMs, 1000));
check('마감 시각에 C 화면에 봉투가 뜬다', opened);
if (opened) { await C.p.click('.envelope button'); }
check('공개: C 가 D 의 글을 본다', await until(async () => (await C.p.locator('.board .note').count()) === 1, 8000));
check('마감 후 작성 폼 잠김', await C.p.locator('.locked-card').isVisible());
await D.p.waitForTimeout(500);
await C.p.screenshot({ path: `${SHOTS}/live-secret-revealed.png` });

check('콘솔/CSP 오류 없음', problems.length === 0, '\n   ' + problems.slice(0, 6).join('\n   '));
await browser.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
