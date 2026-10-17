import { test, expect, request } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("full customer journey, documents, six-character password and recovery", async ({
  page,
}) => {
  test.setTimeout(180000);
  test.skip(!process.env.SL_FLOW_EMAIL, "Disposable test account required");
  const email = process.env.SL_FLOW_EMAIL!,
    password = process.env.SL_FLOW_PASSWORD!,
    nextPassword = process.env.SL_FLOW_NEW_PASSWORD!,
    base = process.env.SIDELEDGER_TEST_URL!;
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "이름", exact: true })
    .fill("전체흐름 검증");
  await page.getByRole("textbox", { name: "이메일", exact: true }).fill(email);
  await page
    .getByRole("textbox", { name: "비밀번호", exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "내 장부 시작하기 →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 차곡차곡." }),
  ).toBeVisible();
  const state = async () => await (await page.request.get("/api/state")).json();
  let s = await state();
  let fixtures = [];
  try {
    fixtures = JSON.parse(
      await readFile("../../.runtime/full-flow-fixtures.json", "utf8"),
    );
  } catch {}
  fixtures.push({ id: s.user.id, email });
  await writeFile(
    "../../.runtime/full-flow-fixtures.json",
    JSON.stringify(fixtures),
  );
  await page.getByRole("button", { name: "거래처", exact: true }).click();
  await page
    .getByRole("button", { name: "＋ 거래처 등록", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "거래처 이름", exact: true })
    .fill("사용자흐름 거래처");
  await dialog
    .getByRole("textbox", { name: "이메일 (선택)", exact: true })
    .fill("client@example.com");
  await dialog
    .getByRole("button", { name: "거래처 저장", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  s = await state();
  expect(s.clients).toHaveLength(1);
  const client = s.clients[0].id;
  for (const [kind, amount, category, memo] of [
    ["income", "10000", "외주 수입", "사용자 수입"],
    ["expense", "2000", "소프트웨어", "사용자 경비"],
  ]) {
    await page
      .getByRole("button", { name: "수입 · 경비", exact: true })
      .click();
    await page
      .getByRole("button", { name: "＋ 수입 · 경비 기록", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "구분", exact: true })
      .selectOption(kind);
    await dialog
      .getByRole("textbox", { name: "금액 (원)", exact: true })
      .fill(amount);
    await dialog
      .getByRole("textbox", { name: "분류", exact: true })
      .fill(category);
    await dialog
      .getByRole("combobox", { name: "거래처 (선택)", exact: true })
      .selectOption(client);
    await dialog.getByRole("textbox", { name: "적요", exact: true }).fill(memo);
    await dialog
      .getByRole("button", { name: "기록 저장", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  s = await state();
  expect(s.entries).toHaveLength(2);
  expect(
    s.entries.reduce(
      (n: number, x: any) => n + (x.kind === "income" ? x.amount : -x.amount),
      0,
    ),
  ).toBe(8000);
  for (const kind of ["invoice", "quote"]) {
    await page
      .getByRole("button", { name: "견적서 · 청구서", exact: true })
      .click();
    await page
      .getByRole("button", { name: "＋ 새 문서 작성", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "종류", exact: true })
      .selectOption(kind);
    await dialog
      .getByRole("combobox", { name: "거래처", exact: true })
      .selectOption(client);
    await dialog
      .getByRole("textbox", { name: "항목 1", exact: true })
      .fill("전체흐름 검증 항목");
    await dialog
      .getByRole("spinbutton", { name: "수량 1", exact: true })
      .fill("1.25");
    await dialog
      .getByRole("textbox", { name: "단가 1", exact: true })
      .fill("1000");
    await dialog
      .getByRole("button", { name: "초안 만들기", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const row = page
      .getByRole("row")
      .filter({ hasText: kind === "invoice" ? "INV-" : "QUO-" });
    await row.getByRole("button", { name: "상세 →", exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("합계 1,250원", { exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await dialog
      .getByRole("link", { name: "PDF 다운로드 ↓", exact: true })
      .click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    await download.saveAs(
      "../../History/2026-10-17_v1.2.0/evidence/flow-" + kind + ".pdf",
    );
    await dialog
      .getByRole("button", { name: "보냄 표시", exact: true })
      .click();
    if (kind === "invoice") {
      await dialog
        .getByRole("button", { name: "입금 완료", exact: true })
        .click();
      await expect(
        dialog.getByText("입금 완료", { exact: true }),
      ).toBeVisible();
    }
    await dialog.getByRole("button", { name: "창 닫기", exact: true }).click();
  }
  s = await state();
  expect(s.documents).toHaveLength(2);
  expect(s.entries.filter((e: any) => e.document_id)).toHaveLength(1);
  expect(
    s.entries
      .filter((e: any) => e.kind === "income")
      .reduce((n: number, e: any) => n + e.amount, 0),
  ).toBe(11250);
  await page.getByRole("button", { name: "대시보드", exact: true }).click();
  await page.screenshot({
    path: "../../History/2026-10-17_v1.2.0/evidence/full-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("현재 비밀번호", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "복구코드 발급 · 재발급", exact: true })
    .click();
  const codeField = page.getByLabel("발급된 복구코드", { exact: true });
  await expect(codeField).toHaveValue(/^[a-f0-9-]{71}$/);
  const code = await codeField.inputValue();
  await page
    .getByRole("button", { name: "보관 완료 · 숨기기", exact: true })
    .click();
  const oldSession = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  expect(
    (
      await oldSession.post("/api/auth/login", { data: { email, password } })
    ).status(),
  ).toBe(200);
  expect((await oldSession.get("/api/state")).status()).toBe(200);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("button", { name: "이메일 찾기", exact: true }).click();
  await page.getByLabel("복구코드", { exact: true }).fill(code);
  await page.getByRole("button", { name: "이메일 확인", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await page.getByLabel("복구코드", { exact: true }).fill(code);
  await page.getByLabel("새 비밀번호", { exact: true }).fill(nextPassword);
  await page
    .getByRole("button", { name: "비밀번호 재설정", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "비밀번호를 변경했습니다.",
  );
  expect((await oldSession.get("/api/state")).status()).toBe(401);
  await oldSession.dispose();
  expect(
    (
      await page.request.post("/api/auth/recovery-find", {
        headers: { Origin: base },
        data: { code },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth/recovery-reset", {
        headers: { Origin: base },
        data: { code, password: nextPassword },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth/recovery-find", {
        headers: { Origin: base },
        data: { code: "0".repeat(64) },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers: { Origin: base },
        data: { email, password },
      })
    ).status(),
  ).toBe(401);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("textbox", { name: "이메일", exact: true }).fill(email);
  await page
    .getByRole("textbox", { name: "비밀번호", exact: true })
    .fill(nextPassword);
  await page.getByRole("button", { name: "로그인 →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘도, 차곡차곡." }),
  ).toBeVisible();
  s = await state();
  expect(s.entries).toHaveLength(3);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("현재 비밀번호", { exact: true }).fill(nextPassword);
  await page
    .getByRole("button", { name: "복구코드 발급 · 재발급", exact: true })
    .click();
  await expect(codeField).toHaveValue(/^[a-f0-9-]{71}$/);
  const code2 = await codeField.inputValue();
  await page
    .getByRole("button", { name: "보관 완료 · 숨기기", exact: true })
    .click();
  await page.getByLabel("현재 비밀번호", { exact: true }).fill(nextPassword);
  await page
    .getByRole("button", { name: "복구코드 발급 · 재발급", exact: true })
    .click();
  await expect(codeField).not.toHaveValue(code2);
  await page
    .getByRole("button", { name: "보관 완료 · 숨기기", exact: true })
    .click();
  expect(
    (
      await page.request.post("/api/auth/recovery-find", {
        headers: { Origin: base },
        data: { code: code2 },
      })
    ).status(),
  ).toBe(400);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.screenshot({
    path: "../../History/2026-10-17_v1.2.0/evidence/recovery-login.png",
    fullPage: true,
  });
  await writeFile(
    "../../History/2026-10-17_v1.2.0/evidence/full-flow-result.json",
    JSON.stringify({
      at: new Date().toISOString(),
      result: "PASS",
      checks: [
        "six-character signup",
        "client UI",
        "income and expense UI",
        "invoice and quote UI",
        "PDF downloads",
        "paid income once",
        "recovery issuance with password",
        "find email by code",
        "password reset without mail",
        "old session denied",
        "invalid and reused code denied",
        "old password denied",
        "new password login preserves ledger",
        "reissue invalidates earlier code",
      ],
    }),
  );
});
