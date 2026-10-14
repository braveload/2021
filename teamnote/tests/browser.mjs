import { chromium } from "playwright";
const BASE = process.env.BASE || "http://web:3000";
const tag = Math.random().toString(36).slice(2, 7);
const out = [];
const log = (ok, m) => out.push(`${ok ? "PASS" : "FAIL"}  ${m}`);
function nextWeekday() { const d = new Date(Date.now() + 9 * 3600e3); do { d.setUTCDate(d.getUTCDate() + 1); } while ([0, 6].includes(d.getUTCDay())); return d.toISOString().slice(0, 10); }
const browser = await chromium.launch();
for (const [label, opt] of [["desktop", { viewport: { width: 1280, height: 800 } }],
  ["mobile", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext(opt); const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `/shots/${label}-${n}.png`, fullPage: true });
  const overflow = async (w) => log((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `${label} 가로 스크롤 없음: ${w}`);
  await page.goto(BASE + "/"); await overflow("랜딩"); await shot("1-landing");
  await page.click("text=무료로 시작하기");
  await page.fill("#name", `${label}팀장`); await page.fill("#email", `${tag}-${label}@t.local`); await page.fill("#pw", "password123");
  await page.click("text=가입하고 시작"); await page.waitForURL("**/dashboard**"); log(true, `${label} 가입`);
  await page.goto(BASE + "/teams/new"); await page.fill("#name", `${label} 개발팀`); await page.fill("#days", "12");
  await page.click("main form button"); await page.waitForURL(/\/teams\/[0-9a-f-]{36}/); log(true, `${label} 팀 생성(지급 12일)`);
  const wd = nextWeekday();
  const today = new Date(Date.now() + 9 * 3600e3).getUTCDay();
  if (![0, 6].includes(today)) {
    await page.click("button:has-text('재택')"); await page.waitForSelector("text=현재: 🏠 재택"); log(true, `${label} 오늘 상태 체크`);
  }
  await page.selectOption("#kind", "half_am"); await page.fill("#sd", wd);
  await page.click("text=신청하기"); await page.waitForSelector("text=연차를 신청했어요"); log(true, `${label} 반차 신청`);
  await page.waitForSelector("text=승인 대기 1건"); await page.click("button:has-text('승인')");
  await page.waitForSelector("text=승인했어요"); log(true, `${label} 승인 처리`);
  const body = await page.textContent("main");
  log(/잔여/.test(body) && /11\.5/.test(body), `${label} 잔여 11.5일 표시`);
  await overflow("팀 페이지"); await shot("2-team");
  const small = await page.$$eval(".btn:not(.sm), input:not([type=hidden]), select", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).length);
  log(small === 0, `${label} 주요 버튼/입력 높이 ≥ 44px`);
  log(errors.length === 0, `${label} 콘솔/페이지 오류 없음${errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
console.log(out.join("\n")); process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
