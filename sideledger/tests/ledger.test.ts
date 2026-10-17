import {test} from "node:test";
import assert from "node:assert/strict";
import {money,qty100,total,date,csvCell,MAX} from "../src/server/ledger";
test("정수 원 검증: 소수, 음수, 안전범위 초과 거절", () => {
  assert.equal(money(1000), 1000);
  for (const x of [0, -1, 0.5, NaN, Infinity, MAX + 1, "1000"])
    assert.throws(() => money(x));
  assert.equal(money(0, true), 0);
});
test("수량과 합계는 정수 기반으로 마지막에 반올림", () => {
  assert.equal(qty100("0.01"), 1);
  assert.equal(qty100("1.25"), 125);
  assert.throws(() => qty100("1.001"));
  assert.throws(() => qty100("0"));
  assert.equal(
    total([
      { qty100: 1, unit_price: 50 },
      { qty100: 1, unit_price: 50 },
    ]),
    1,
  );
  assert.throws(() => total([{ qty100: 200, unit_price: MAX }]));
});
test("윤년/잘못된 날짜 검사", () => {
  assert.equal(date("2024-02-29"), "2024-02-29");
  assert.throws(() => date("2026-02-29"));
  assert.throws(() => date("2026-13-01"));
});
test("CSV 수식 삽입 및 따옴표 처리", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("정상"), '"정상"');
  assert.ok(csvCell("  +1").startsWith("\"'"));
});
