import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("email signup immediately opens workspace and supports password login", async ({
  page,
}) => {
  test.skip(
    !process.env.SL_SIGNUP_EMAIL || !process.env.SL_SIGNUP_PASSWORD,
    "Disposable signup credentials required",
  );
  await page.goto("/");
  await expect(page.getByText(/이메일 인증 없이 바로 가입/)).toBeVisible();
  await page
    .getByRole("textbox", { name: "이름", exact: true })
    .fill("즉시가입 검증");
  await page
    .getByRole("textbox", { name: "이메일", exact: true })
    .fill(process.env.SL_SIGNUP_EMAIL!);
  await page
    .getByRole("textbox", { name: "비밀번호", exact: true })
    .fill(process.env.SL_SIGNUP_PASSWORD!);
  await page
    .getByRole("button", { name: "내 장부 시작하기 →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 차곡차곡." }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.user.email).toBe(process.env.SL_SIGNUP_EMAIL);
  await writeFile(
    "../../.runtime/immediate-signup-fixture.json",
    JSON.stringify({ id: state.user.id, email: state.user.email }),
  );
  await page.screenshot({
    path: "../../History/2026-10-17_v1.2.4/evidence/immediate-signup-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: /로그아웃/ }).click();
  expect((await page.request.get("/api/state")).status()).toBe(401);
  await expect(page.getByRole("button", {name: "로그인 →", exact: true})).toBeVisible();
  await page
    .getByRole("textbox", { name: "이메일", exact: true })
    .fill(process.env.SL_SIGNUP_EMAIL!);
  await page
    .getByRole("textbox", { name: "비밀번호", exact: true })
    .fill(process.env.SL_SIGNUP_PASSWORD!);
  await page.getByRole("button", { name: "로그인 →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 차곡차곡." }),
  ).toBeVisible();
  const duplicate = await page.request.post("/api/auth/register", {
    headers: { Origin: process.env.SIDELEDGER_TEST_URL! },
    data: {
      name: "중복 검증",
      email: process.env.SL_SIGNUP_EMAIL,
      password: process.env.SL_SIGNUP_PASSWORD,
    },
  });
  expect(duplicate.status()).toBe(400);
  await page.request.post("/api/auth/logout", {
    headers: { Origin: process.env.SIDELEDGER_TEST_URL! },
    data: {},
  });
  await writeFile(
    "../../History/2026-10-17_v1.2.4/evidence/immediate-signup-result.json",
    JSON.stringify({
      at: new Date().toISOString(),
      result: "PASS",
      checks: [
        "UI signup without email verification",
        "immediate session and own workspace",
        "logout denies access",
        "password re-login",
        "duplicate signup rejected",
      ],
    }),
  );
});
