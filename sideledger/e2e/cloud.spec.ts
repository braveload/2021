import { test, expect } from "@playwright/test";
test("deployed cloud health and anonymous protection", async ({
  page,
  request,
}) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBeTruthy();
  expect(await r.json()).toMatchObject({
    version: "1.1.0",
    storage: "supabase",
  });
  expect((await request.get("/api/state")).status()).toBe(401);
  await page.goto("/");
  await page
    .getByRole("button", { name: "이미 계정이 있어요 · 로그인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그인 →", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../History/2026-10-17_v1.1.0/evidence/deployed-login.png",
    fullPage: true,
  });
  if (process.env.SL_TEST_A && process.env.SL_TEST_PASSWORD) {
    await page
      .getByRole("textbox", { name: "이메일", exact: true })
      .fill(process.env.SL_TEST_A);
    await page
      .getByRole("textbox", { name: "비밀번호", exact: true })
      .fill(process.env.SL_TEST_PASSWORD);
    await page.getByRole("button", { name: "로그인 →", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "오늘도, 차곡차곡." }),
    ).toBeVisible();
    await page.screenshot({
      path: "../../History/2026-10-17_v1.1.0/evidence/deployed-dashboard.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page.getByRole("button", { name: /로그아웃/ }).click();
    await expect(
      page.getByRole("button", { name: "로그인 →", exact: true }),
    ).toBeVisible();
  }
});
