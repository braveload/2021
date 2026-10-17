import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.SIDELEDGER_TEST_URL;
if (
  !base ||
  !process.env.SL_TEST_A ||
  !process.env.SL_TEST_B ||
  !process.env.SL_TEST_PASSWORD
)
  throw Error("Explicit test URL and disposable test accounts required");
function session() {
  let cookies = "";
  return async (path, method = "GET", body) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: base,
        ...(cookies ? { Cookie: cookies } : {}),
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    if (r.headers.getSetCookie().length)
      cookies = r.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; ");
    return r;
  };
}
const a = session(),
  b = session();
assert.equal((await a("/api/state")).status, 401);
for (const [call, email] of [
  [a, process.env.SL_TEST_A],
  [b, process.env.SL_TEST_B],
]) {
  const r = await call("/api/auth/login", "POST", {
    email,
    password: process.env.SL_TEST_PASSWORD,
  });
  assert.equal(r.status, 200, await r.text());
}
const cr = await a("/api/clients", "POST", {
  name: "배포 검증 거래처",
  email: "",
});
assert.equal(cr.status, 201, await cr.clone().text());
const client = await cr.json();
const er = await a("/api/entries", "POST", {
  kind: "expense",
  amount: 500,
  occurred_on: "2026-10-17",
  category: "검증",
  memo: "테스트 전용",
  client_id: client.id,
});
assert.equal(er.status, 201, await er.clone().text());
const entry = await er.json();
const dr = await a("/api/documents", "POST", {
  kind: "invoice",
  client_id: client.id,
  issued_on: "2026-10-17",
  due_on: "2026-10-31",
  notes: "배포 검증",
  items: [{ description: "검증", qty: "1.25", unit_price: 1000 }],
});
assert.equal(dr.status, 201, await dr.clone().text());
const d = await dr.json();
assert.equal((await b("/api/documents/" + d.id)).status, 404);
for (const status of ["sent", "paid", "paid"])
  assert.equal(
    (
      await a("/api/documents/" + d.id, "PATCH", {
        status,
        paid_on: "2026-10-17",
      })
    ).status,
    200,
  );
const state = await (await a("/api/state")).json();
assert.equal(state.entries.filter((e) => e.document_id === d.id).length, 1);
assert.equal(state.documents.find((x) => x.id === d.id).total, 1250);
assert.equal((await (await b("/api/state")).json()).clients.length, 0);
const pdf = await a("/api/documents/" + d.id + "/pdf");
assert.equal(pdf.status, 200, await pdf.clone().text());
const data = Buffer.from(await pdf.arrayBuffer());
assert.equal(data.subarray(0, 4).toString(), "%PDF");
await writeFile(
  "../../History/2026-10-17_v1.2.3/evidence/deployed-invoice.pdf",
  data,
);
const form = new FormData();
form.set("entry_id", entry.id);
form.set(
  "file",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQAAAABJRU5ErkJggg==",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "test.png",
);
const rr = await a("/api/receipts", "POST", form);
assert.equal(rr.status, 201, await rr.clone().text());
const receipt = await rr.json();
assert.equal((await b("/api/receipts/" + receipt.id)).status, 404);
const link = await (await a("/api/receipts/" + receipt.id)).json();
assert.equal((await fetch(link.url)).status, 200);
assert.equal((await a("/api/receipts/" + receipt.id, "DELETE")).status, 200);
const csv = await a("/api/export");
assert.equal(csv.status, 200);
assert.match(await csv.text(), /검증/);
for (const call of [a, b])
  assert.equal((await call("/api/auth/logout", "POST", {})).status, 200);
const result = {
  checkedAt: new Date().toISOString(),
  base,
  result: "PASS",
  checks: [
    "anonymous protection",
    "two-account login",
    "clients and entries persisted",
    "invoice calculation",
    "cross-owner denial",
    "paid idempotency",
    "PDF response",
    "CSV export",
    "private receipt upload, signed access, cross-owner denial and removal",
    "logout",
  ],
};
await writeFile(
  "../../History/2026-10-17_v1.2.3/evidence/cloud-results.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
