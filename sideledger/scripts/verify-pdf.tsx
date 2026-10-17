import { writeFileSync } from "node:fs";
import path from "node:path";
import { pdf } from "../src/server/pdf";
async function main() {
  const items = Array.from({ length: 30 }, (_, i) => ({
    description: `검증 항목 ${i + 1} · 한글 긴 설명 `.repeat(3),
    qty100: 125,
    unit_price: 10000,
  }));
  const d = {
    kind: "quote",
    number: "QUO-2026-TEST",
    issued_on: "2026-10-17",
    due_on: "2026-10-31",
    client_name: "검증용 거래처",
    total: 375000,
    notes: "긴 문서 페이지 나누기 검증. ".repeat(25),
    items,
  };
  const result = await pdf(d, {
    name: "검증 사용자",
    email: "pdf@example.test",
    account: "검증 은행 · 000-000 · 테스트",
  });
  writeFileSync(
    path.resolve(
      "../../History/2026-10-17_v1.1.2/evidence/quote-multipage.pdf",
    ),
    result,
  );
  console.log("Multipage PDF saved.");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
