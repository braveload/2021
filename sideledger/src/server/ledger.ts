export type Row = Record<string, any>;
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
export const MAX = 9_000_000_000_000;
export function str(v: unknown, max = 200, required = true) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new AppError("입력 내용을 확인해 주세요.");
  return v.trim();
}
export function date(v: unknown) {
  const s = str(v, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new AppError("올바른 날짜를 입력해 주세요.");
  return s;
}
export function money(v: unknown, zero = false) {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < (zero ? 0 : 1) ||
    v > MAX
  )
    throw new AppError("금액은 1원 이상 9조 원 이하의 정수로 입력해 주세요.");
  return v;
}
export function qty100(v: unknown) {
  const s = String(v);
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s))
    throw new AppError("수량은 소수 둘째 자리까지 입력할 수 있습니다.");
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (n < 1) throw new AppError("수량은 0보다 커야 합니다.");
  return n;
}
export function total(items: { qty100: number; unit_price: number }[]) {
  const n = items.reduce(
    (s, i) => s + BigInt(i.qty100) * BigInt(i.unit_price),
    0n,
  );
  const r = (n + 50n) / 100n;
  if (r > BigInt(MAX)) throw new AppError("합계가 최대 금액을 초과합니다.");
  return Number(r);
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
