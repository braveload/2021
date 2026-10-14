import { Pool, PoolClient, QueryResultRow } from "pg";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const g = globalThis as unknown as { __cnPool?: Pool };
const pool: Pool = (g.__cnPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
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
  not_authenticated: "로그인이 필요해요.",
  forbidden: "권한이 없어요.",
  member_limit: "크루 멤버 수 제한(무료 30명)에 도달했어요. 운영자에게 Pro 전환을 요청하세요.",
  invalid_invite: "초대 링크가 올바르지 않아요.",
  event_started: "이미 시작된 모임은 신청·취소·수정할 수 없어요.",
  past_time: "모임 시간은 현재 이후여야 해요.",
  capacity_below_attending: "현재 참석 인원보다 작은 정원으로 줄일 수 없어요.",
  staff_limit: "운영진 수 제한(무료 1명 / Pro 5명)을 넘었어요.",
  too_many_members: "멤버가 30명을 넘어 무료로 되돌릴 수 없어요.",
  too_early: "출석 체크는 시작 2시간 전부터 가능해요.",
  not_attending: "참석 확정자만 출석 체크할 수 있어요.",
  not_started: "모임이 시작된 뒤에 소감을 남길 수 있어요.",
  not_attended: "출석 체크된 참석자만 소감을 남길 수 있어요.",
  email_taken: "이미 가입된 이메일이에요.",
  not_found: "대상을 찾을 수 없어요.",
};

export function errMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (ERRORS[m]) return ERRORS[m];
  if (/violates check constraint/.test(m)) return "입력값이 규칙에 맞지 않아요. 길이와 범위를 확인해주세요.";
  return "처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}
