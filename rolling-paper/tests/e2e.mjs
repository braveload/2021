// 브라우저 E2E (데모/로컬 저장소 기준). Docker 안에서 실행: docker compose run --rm e2e
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3015';
const SHOTS = process.env.SHOTS_DIR || './shots';
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name} ${extra}`); }
}
async function until(fn, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch { /* retry */ }
    if (Date.now() > end) throw new Error('until(): timeout');
    await new Promise((r) => setTimeout(r, 100));
  }
}
const section = (t) => console.log(`\n■ ${t}`);

// 1x1 보다 큰 실제 PNG 생성 (사진 업로드 테스트용)
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADq0RJvUJAAAAAElFTkSuQmCC', 'base64');

const browser = await chromium.launch();
const problems = [];
const watch = (page, tag) => {
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/fonts\.(googleapis|gstatic)/.test(t) || /ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION)/.test(t)) return;
    problems.push(`[${tag}] console.error: ${t}`);
  });
};

async function createBoard(page, { title, theme, deadlineOffsetMin, secret } = {}) {
  await page.goto(BASE + '/?desktop=1');
  await page.waitForSelector('#create-form');
  if (theme) await page.click(`label.chip-radio:has(input[value="${theme}"])`);
  if (title) await page.fill('#f-title', title);
  if (deadlineOffsetMin != null) {
    const d = new Date(Date.now() + deadlineOffsetMin * 60000);
    const p = (n) => String(n).padStart(2, '0');
    await page.fill('#f-deadline', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
  }
  if (secret) await page.check('#f-secret');
  await page.click('#create-form button[type=submit]');
  await page.waitForSelector('.topbar');
  return new URL(page.url()).searchParams.get('b');
}

async function post(page, { nick, msg, color, sticker, photo } = {}) {
  const sheet = await page.locator('.fab').isVisible();
  if (sheet) { await page.click('.fab'); await page.waitForTimeout(350); }
  if (nick != null) await page.fill('#c-nick', nick);
  await page.fill('#c-msg', msg);
  if (color) await page.click(`.swatch.color-${color}`);
  if (sticker) await page.click(`.sticker-opt:has(input[value="${sticker}"])`);
  if (photo) { await page.setInputFiles('#c-photo', { name: 'p.png', mimeType: 'image/png', buffer: png }); await page.waitForSelector('.photo-thumb img'); }
  await page.click('.composer button[type=submit]');
}

// ======================================================================
section('PC: 홈 → 보드 생성 → 글쓰기');
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const A = await ctx.newPage(); watch(A, 'A');
await A.goto(BASE + '/?desktop=1');
await A.waitForSelector('#create-form');
check('홈 화면이 열린다', (await A.title()).includes('롤링페이퍼'));
check('데모 모드 배너(키 미설정)', await A.locator('.demo-banner').count() === 1);
await A.screenshot({ path: `${SHOTS}/01-home-desktop.png` });

const code = await createBoard(A, { title: '지수님 생일 축하해요!', theme: 'birthday' });
check('보드 코드가 URL 에 생성', /^[a-z0-9]{6}$/.test(code), code);
await A.waitForSelector('.overlay .qr svg', { timeout: 15000 }).catch(() => {});
check('생성 직후 초대 모달 + QR 표시', await A.locator('.overlay .qr svg').count() === 1);
check('관리자 링크 안내 표시', await A.locator('.admin-box').count() === 1);
await A.screenshot({ path: `${SHOTS}/02-share-modal.png` });
await A.keyboard.press('Escape');
check('ESC 로 모달 닫힘', await A.locator('.overlay').count() === 0);
check('제목 렌더', (await A.textContent('#board-title')) === '지수님 생일 축하해요!');
check('빈 보드 안내', await A.locator('.empty').isVisible());

// 두 번째 창(같은 브라우저) = 실시간 확인용
const B = await ctx.newPage(); watch(B, 'B');
await B.goto(`${BASE}/?b=${code}&desktop=1`);
await B.waitForSelector('.topbar');
await A.waitForTimeout(1200);
check('접속자 수(Presence) 2명', (await A.textContent('.chip:has-text("👀")')).includes('2'));

await post(A, { nick: '민지', msg: '생일 축하해요! 🎂', color: 'pink', sticker: '🎉' });
await A.waitForSelector('.note:not(.preview)');
check('내 화면에 포스트잇이 붙는다', await A.locator('.board .note').count() === 1);
check('색상 반영(pink)', await A.locator('.board .note.color-pink').count() === 1);
check('스티커 표시', (await A.textContent('.board .note .sticker')) === '🎉');
await B.waitForSelector('.board .note', { timeout: 5000 });
check('[실시간] 새로고침 없이 B 창에 붙는다', await B.locator('.board .note').count() === 1);
check('내 글이 중복으로 붙지 않는다', await A.locator('.board .note').count() === 1);
check('작성 후 입력창 초기화', (await A.inputValue('#c-msg')) === '');

// 닉네임 비우면 익명, 100자 제한
await A.waitForTimeout(3100);
await post(A, { nick: '', msg: 'x'.repeat(100) });
await until(async () => (await A.locator('.board .note').count()) === 2);
check('닉네임 비우면 익명', (await A.locator('.board .note .author').first().textContent()).includes('익명'));
await A.fill('#c-msg', 'z'.repeat(130));
check('입력창 maxlength=100 적용', (await A.inputValue('#c-msg')).length === 100);
await A.fill('#c-msg', '');

// 도배 방지
await post(A, { msg: '연속 글 1' });
await A.waitForTimeout(300);
await A.fill('#c-msg', '연속 글 2');
await A.evaluate(() => document.querySelector('.composer').requestSubmit());
await A.waitForTimeout(400);
check('3초 도배 방지(쿨다운 토스트)', (await A.textContent('#toast')).includes('3초') || (await A.locator('.board .note').count()) === 3);
await A.fill('#c-msg', '');

// 하트
section('하트 (실시간 카운트)');
const noteA = A.locator('.board .note', { hasText: '생일 축하해요! 🎂' });
await noteA.locator('.heart').click();
await A.waitForTimeout(500);
check('하트 누르면 1', (await noteA.locator('.heart-count').textContent()) === '1');
check('하트 on 상태', (await noteA.locator('.heart').getAttribute('aria-pressed')) === 'true');
const noteB = B.locator('.board .note', { hasText: '생일 축하해요! 🎂' });
await until(async () => (await noteB.locator('.heart-count').textContent()) === '1').catch(() => {});
check('[실시간] B 화면의 하트 숫자도 증가', (await noteB.locator('.heart-count').textContent()) === '1');
await noteA.locator('.heart').click();
await A.waitForTimeout(400);
check('다시 누르면 취소(0)', (await noteA.locator('.heart-count').textContent()) === '0');
await noteA.locator('.heart').click(); await A.waitForTimeout(400);
await noteA.locator('.heart').click(); await A.waitForTimeout(150);
await noteA.locator('.heart').click(); await A.waitForTimeout(400);

// 이모지 반응
section('실시간 이모지 반응');
await A.click('.reactbar button >> nth=1');
await B.waitForSelector('.float-emoji', { timeout: 3000 }).catch(() => {});
check('[실시간] A 가 보낸 이모지가 B 화면에 떠오른다', await B.locator('.float-emoji').count() >= 1);

// 사진
section('사진 붙이기 (폴라로이드)');
await A.waitForTimeout(3000);
await post(A, { nick: '준호', msg: '다 같이 찍은 사진!', color: 'mint', photo: true });
await A.waitForSelector('.board .note.has-photo', { timeout: 8000 });
check('폴라로이드 노트 생성', await A.locator('.board .note.has-photo img').count() === 1);
const imgOk = await A.evaluate(() => { const i = document.querySelector('.board .note.has-photo img'); return i.complete && i.naturalWidth > 0; });
check('사진이 실제로 로드된다', imgOk);
await A.screenshot({ path: `${SHOTS}/03-board-desktop.png` });

// 슬라이드쇼 / CSV
section('슬라이드쇼 · CSV · 관리자');
await A.click('.act:has-text("슬라이드쇼")');
await A.waitForSelector('.slideshow .slide-note');
check('슬라이드쇼 열림', await A.locator('.slideshow .slide-note').count() === 1);
await A.screenshot({ path: `${SHOTS}/04-slideshow.png` });
await A.keyboard.press('ArrowRight');
await A.keyboard.press('Escape');
check('ESC 로 슬라이드쇼 닫힘', await A.locator('.slideshow').count() === 0);
const [dl] = await Promise.all([A.waitForEvent('download'), A.click('.act:has-text("CSV")')]);
const csv = fs.readFileSync(await dl.path(), 'utf8');
check('CSV 다운로드(BOM+헤더)', csv.startsWith('﻿번호,작성자,메시지'));
check('CSV 에 글 포함', csv.includes('다 같이 찍은 사진!'));
check('관리자 배지/삭제 버튼 노출(만든 사람)', await A.locator('.chip.admin').count() === 1 && await A.locator('.note .del').count() >= 1);
await B.evaluate((c) => localStorage.removeItem(`rp.admin.${c}`), code);
await B.reload(); await B.waitForSelector('.board .note');
check('방문자(관리자 토큰 없음)에게는 삭제 버튼/배지 없음', await B.locator('.note .del').count() === 0 && await B.locator('.chip.admin').count() === 0);
A.once('dialog', (d) => d.accept());
const before = await A.locator('.board .note').count();
await A.locator('.board .note', { hasText: '다 같이 찍은 사진!' }).locator('.del').click();
await until(async () => (await A.locator('.board .note').count()) === before - 1);
check('관리자 삭제 동작', await A.locator('.board .note').count() === before - 1);
await until(async () => (await B.locator('.board .note').count()) === before - 1).catch(() => {});
check('[실시간] 삭제가 B 에도 반영', await B.locator('.board .note').count() === before - 1);

// 마감 시간 관리
section('마감 시간 · 작성 잠금 · 공개 모드');
await A.click('.act:has-text("관리")');
await A.waitForSelector('#s-deadline');
await A.click('button:has-text("+10분")');
await A.click('.dialog button:has-text("저장")');
await A.waitForSelector('.chip.status:has-text("마감까지")');
check('마감 설정 후 카운트다운 표시', true);
await A.click('.act:has-text("관리")');
await A.click('button:has-text("지금 마감")');
await A.click('.dialog button:has-text("저장")');
await A.waitForSelector('.banner[data-kind=closed]', { timeout: 6000 });
check('마감되면 작성 폼이 잠긴다', await A.locator('#c-msg').isDisabled());
check('마감 배너(공개 모드)', (await A.textContent('.banner')).includes('마감'));
await B.waitForSelector('.banner[data-kind=closed]', { timeout: 6000 }).catch(() => {});
check('[실시간] B 화면도 마감 상태', await B.locator('.banner[data-kind=closed]').count() === 1);
check('마감 후에도 하트는 가능', await A.locator('.board .note .heart').first().isEnabled());
await A.screenshot({ path: `${SHOTS}/05-closed.png` });

// 서프라이즈 모드 (별도 컨텍스트: 다른 사용자)
section('서프라이즈(비밀) 모드 → 마감 시 봉투 공개');
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const C = await ctx2.newPage(); watch(C, 'C');
await C.goto(BASE + '/?desktop=1');
await C.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('rp.local.db.v1') || 'null') || { boards: [], notes: [], hearts: [], seq: 1 };
  db.boards.push({ id: 'sec1', code: 'secret1', title: '비밀 롤링페이퍼', theme: 'farewell', deadline: new Date(Date.now() + 9000).toISOString(), secret: true, created_at: new Date().toISOString(), adminToken: 'x'.repeat(32) });
  // 다른 사람이 이미 쓴 글(내 clientId 가 아님) → 마감 전에는 보이면 안 됨
  db.notes.push({ id: db.seq++, board_id: 'sec1', author: '서연', message: '몰래 쓴 글', color: 'blue', sticker: null, photo_path: null, hearts: 0, created_at: new Date().toISOString(), client: 'other-client', ts: 0 });
  localStorage.setItem('rp.local.db.v1', JSON.stringify(db));
});
await C.goto(BASE + '/?b=secret1&desktop=1');
await C.waitForSelector('.topbar');
check('비밀 모드: 마감 전엔 남의 글이 안 보인다', await C.locator('.board .note').count() === 0);
check('비밀 모드 배너', await C.locator('.banner[data-kind=secret]').count() === 1);
await post(C, { nick: '나', msg: '내가 쓴 비밀 글' });
await C.waitForSelector('.board .note.secret-mine');
check('내가 쓴 글만 🔒 로 보인다', await C.locator('.board .note').count() === 1 && await C.locator('.lock-tag').count() === 1);
await C.screenshot({ path: `${SHOTS}/06-secret.png` });
await C.waitForSelector('.envelope', { timeout: 15000 });
check('마감 시각에 봉투 연출이 뜬다', await C.locator('.envelope').count() === 1);
await C.screenshot({ path: `${SHOTS}/07-envelope.png` });
await C.click('.envelope button');
await until(async () => (await C.locator('.board .note').count()) === 2);
check('열어보면 모든 글이 공개된다', await C.locator('.board .note').count() === 2);
check('공개 후 🔒 표시 사라짐', await C.locator('.lock-tag').count() === 0);
await C.waitForTimeout(1500);
await C.screenshot({ path: `${SHOTS}/08-revealed.png` });
await ctx2.close();

// ======================================================================
section('모바일: 같은 주소 → /m/ 자동 이동 + 모바일 UI');
const iphone = devices['iPhone 13'];
const ctxM = await browser.newContext({ ...iphone });
const M = await ctxM.newPage(); watch(M, 'M');
await M.goto(BASE + '/');
await M.waitForURL('**/m/**', { timeout: 5000 }).catch(() => {});
check('휴대폰 UA 는 /m/ 으로 자동 변환', new URL(M.url()).pathname.startsWith('/m'), M.url());
await M.waitForSelector('#create-form');
await M.screenshot({ path: `${SHOTS}/09-home-mobile.png`, fullPage: true });
check('모바일 홈이 가로 스크롤 없이 맞는다', await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await M.fill('#f-title', '모바일 테스트 보드');
await M.click('#create-form button[type=submit]');
await M.waitForSelector('.topbar');
await M.keyboard.press('Escape');
check('모바일 URL 유지 (/m/?b=)', new URL(M.url()).pathname.startsWith('/m') && new URL(M.url()).searchParams.has('b'));
check('FAB(쓰기) 버튼 표시', await M.locator('.fab').isVisible());
await M.click('.fab');
await M.waitForTimeout(450);
await M.screenshot({ path: `${SHOTS}/10-mobile-sheet.png` });
await M.fill('#c-nick', '폰유저');
await M.fill('#c-msg', '폰에서 썼어요 📱');
await M.click('.composer button[type=submit]');
await M.waitForSelector('.board .note');
await M.waitForTimeout(900);
check('모바일에서 글쓰기 성공', await M.locator('.board .note').count() === 1);
check('시트가 자동으로 닫힌다', !(await M.evaluate(() => document.querySelector('#app').classList.contains('composer-open'))));
check('모바일 보드 가로 스크롤 없음', await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await M.screenshot({ path: `${SHOTS}/11-board-mobile.png` });
// PC 강제 보기 링크
await M.goto(BASE + '/?desktop=1');
await M.waitForTimeout(600);
check('?desktop=1 이면 PC 화면 유지', !new URL(M.url()).pathname.startsWith('/m'));
await ctxM.close();

// 안드로이드 UA / 태블릿
const ctxAnd = await browser.newContext({ ...devices['Pixel 7'] });
const And = await ctxAnd.newPage(); watch(And, 'And');
await And.goto(BASE + '/');
await And.waitForURL('**/m/**', { timeout: 5000 }).catch(() => {});
check('안드로이드도 /m/ 으로 이동', new URL(And.url()).pathname.startsWith('/m'));
await ctxAnd.close();
const ctxPc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const Pc = await ctxPc.newPage(); watch(Pc, 'PC');
await Pc.goto(BASE + '/');
await Pc.waitForTimeout(800);
check('PC 는 이동하지 않는다', !new URL(Pc.url()).pathname.startsWith('/m'));
// 좁은 PC 창에서도 반응형
await Pc.setViewportSize({ width: 600, height: 900 });
await Pc.waitForTimeout(300);
check('좁은 PC 창도 가로 스크롤 없음', await Pc.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await ctxPc.close();

// 존재하지 않는 코드
section('예외 처리');
const E = await (await browser.newContext()).newPage(); watch(E, 'E');
await E.goto(BASE + '/?b=nope123&desktop=1');
await E.waitForSelector('.center-msg h1');
check('없는 코드는 안내 화면', (await E.textContent('.center-msg h1')).includes('찾을 수 없'));

check('CSP/콘솔 오류 없음', problems.length === 0, '\n    ' + problems.join('\n    '));

await browser.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) { console.log('실패 항목:\n - ' + failures.join('\n - ')); process.exit(1); }
