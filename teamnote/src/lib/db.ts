import { Pool, PoolClient, QueryResultRow, types } from "pg";
types.setTypeParser(1082, (v: string) => v); // date → "YYYY-MM-DD" 문자열 (시간대 변환 방지)
types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric → number
import crypto from "node:crypto";
import { cookies } from "next/headers";

const g = globalThis as unknown as { __cnPool?: Pool };
const pool: Pool = (g.__cnPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /supabase.(com|co)/.test(process.env.DATABASE_URL ?? "") ? { rejectUnauthorized: false } : undefined,
  max: 10,
  statement_timeout: 10000,
}));

/** 사용자 컨텍스트(app.user_id)를 트랜잭션에 주입해 RLS가 적용되게 한다. */
export async function withUser<T>(uid: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.user_id', $1, true)", [uid ?? ""]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function q<T extends QueryResultRow = any>(uid: string | null, sql: string, params: unknown[] = []) {
  return withUser(uid, async (c) => (await c.query<T>(sql, params)).rows);
}

export const COOKIE = "cn_session";
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export type SessionUser = { id: string; name: string; email: string };

export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const rows = await q<SessionUser>(null, "select * from auth_session_user($1)", [sha256(token)]);
  return rows[0] ?? null;
}

export const ERRORS: Record<string, string> = {
  last_admin: "마지막 관리자는 팀원으로 변경할 수 없어요. 다른 관리자를 먼저 지정해주세요.",
  invalid_admin_invite: "만료되었거나 올바르지 않은 관리자 초대예요.",
  admin_invite_used: "이미 다른 계정에서 사용한 관리자 초대예요.",
  admin_name_mismatch: "이 관리자 초대의 지정된 이름과 현재 계정이 달라요.",
  not_authenticated: "로그인이 필요해요.",
  forbidden: "권한이 없어요.",
  invalid_invite: "초대 링크가 올바르지 않아요.",
  email_taken: "이미 가입된 이메일이에요.",
  not_found: "대상을 찾을 수 없어요.",
  invalid_role: "올바르지 않은 역할이에요.",
  invalid_kind: "연차 종류가 올바르지 않아요.",
  invalid_dates: "날짜를 확인해주세요.",
  invalid_status: "상태 값이 올바르지 않아요.",
  past_date: "지난 날짜는 신청할 수 없어요.",
  too_long: "한 번에 60일을 넘길 수 없어요.",
  cross_year: "연도를 넘는 신청은 연도별로 나눠 신청해주세요.",
  no_workdays: "선택한 기간에 근무일(월~금)이 없어요.",
  overlap: "이미 신청한 연차와 기간이 겹쳐요.",
  insufficient_balance: "잔여 연차가 부족해요.",
  self_approval: "본인 신청은 팀장만 승인할 수 있어요.",
  already_decided: "이미 처리된 신청이에요.",
  leave_started: "이미 시작된 연차는 취소할 수 없어요. 팀장에게 문의해주세요.",
  weekend: "주말에는 출석 체크를 하지 않아요.",
  on_leave: "오늘은 승인된 연차예요.",
  future_date: "미래 날짜는 기록할 수 없어요.",
  service_closed: "학습용 데모 운영이 종료되어 더 이상 쓰기를 받지 않아요.",
};

export function errMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (ERRORS[m]) return ERRORS[m];
  if (/violates check constraint/.test(m)) return "입력값이 규칙에 맞지 않아요. 길이와 범위를 확인해주세요.";
  return "처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}
