import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AppError, Row } from "./ledger";
export async function cloud() {
  const jar = await cookies();
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new AppError(
      "Supabase 연결 설정이 없습니다. 관리자에게 문의해 주세요.",
      503,
    );
  return createServerClient(url, key, {
    cookieOptions: {
      name: "sl-auth",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.VERCEL === "1",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
}
export function checked<T extends { error: unknown; data?: unknown }>(
  r: T,
): T["data"] {
  if (r.error) {
    const e = r.error as Row;
    const text = String(e.message || "");
    if (text.includes("FREE_"))
      throw new AppError("무료 이용 한도에 도달했습니다.", 409);
    if (text.includes("AMOUNT_LIMIT"))
      throw new AppError("누적 금액은 9조 원까지 지원합니다.", 409);
    if (text.includes("NOT_FOUND"))
      throw new AppError("내역 또는 거래처를 찾을 수 없습니다.", 404);
    if (text.includes("IMMUTABLE"))
      throw new AppError("입금 완료 수입은 변경할 수 없습니다.");
    if (e.code === "23503")
      throw new AppError("연결된 내역이 있거나 거래처가 올바르지 않습니다.");
    if (e.code === "42501") throw new AppError("접근 권한이 없습니다.", 403);
    if (e.code === "23505") throw new AppError("이미 등록된 내역입니다.", 409);
    if (text.includes("INVALID_"))
      throw new AppError("입력 또는 상태 변경을 확인해 주세요.");
    console.error("Supabase operation failed", e.code || "unknown");
    throw new AppError("처리 중 오류가 발생했습니다.", 500);
  }
  return r.data;
}
