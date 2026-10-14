// Playwright 컨테이너에서 실행 (docker network: crewnote_default)
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://web:3000";
const tag = Math.random().toString(36).slice(2, 7);
const out = [];
const log = (ok, m) => { out.push(`${ok ? "PASS" : "FAIL"}  ${m}`); };

const browser = await chromium.launch();
for (const [label, ctxOpts] of [
  ["desktop", { viewport: { width: 1280, height: 800 } }],
  ["mobile", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `/shots/${label}-${n}.png`, fullPage: true });
  const noOverflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(o <= 1, `${label} 가로 스크롤 없음: ${where}`);
  };

  await page.goto(BASE + "/");
  await noOverflow("랜딩"); await shot("1-landing");
  await page.click("text=무료로 시작하기");
  await page.fill("#name", `브라우저${label}`);
  await page.fill("#email", `${tag}-${label}@t.local`);
  await page.fill("#pw", "password123");
  await page.click("text=가입하고 시작");
  await page.waitForURL("**/dashboard**");
  log(true, `${label} 가입 후 대시보드`);
  await noOverflow("대시보드"); await shot("2-dashboard");

  await page.goto(BASE + "/crews/new");
  await page.fill("#name", `${label} 러닝크루`);
  await page.fill("#intro", "한강 야간 러닝");
  await page.click("main form button");
  await page.waitForURL(/\/crews\/[0-9a-f-]{36}/);
  log(true, `${label} 크루 생성`);
  await noOverflow("크루"); await shot("3-crew");

  await page.click("text=＋ 모임 만들기");
  await page.fill("#title", "목요 야간런");
  await page.fill("#loc", "여의나루역 2번 출구");
  await page.fill("#cap", "1");
  await page.click("text=모임 열기");
  await page.waitForURL(/\/events\//);
  await page.click("text=참석 신청");
  await page.waitForSelector("text=참석 확정");
  log(true, `${label} 모임 생성 및 참석 신청 → 확정`);
  await noOverflow("모임 상세"); await shot("4-event");
  await page.click("button:has-text('🔥')");
  await page.waitForSelector("button:has-text('🔥 1')");
  log(true, `${label} 이모지 반응 증가`);

  // 터치 영역 크기 검사 (주요 버튼 ≥ 44px)
  const small = await page.$$eval(".btn:not(.sm), input, select", (els) => els.filter((e) => e.getBoundingClientRect().height < 44 && e.getBoundingClientRect().height > 0).length);
  log(small === 0, `${label} 주요 버튼/입력 높이 ≥ 44px`);
  log(errors.length === 0, `${label} 콘솔/페이지 오류 없음${errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
console.log(out.join("\n"));
process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
