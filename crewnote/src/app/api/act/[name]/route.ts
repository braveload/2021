import { NextRequest } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { COOKIE, errMessage, getUser, q, sha256, withUser } from "@/lib/db";
import { kstInputToISO } from "@/lib/format";

export const dynamic = "force-dynamic";

// 로그인 실패 제한 (프로세스 메모리, 이메일당 10분 5회)
const fails = new Map<string, { n: number; t: number }>();

class Fail extends Error {}

function go(path: string, kind: "msg" | "err", text?: string, extra: Record<string, string> = {}) {
  const u = new URL(path, "http://x");
  if (text) u.searchParams.set(kind, text);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { Location: u.pathname + u.search } });
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeNext = (v: string, fb: string) => (v.startsWith("/") && !v.startsWith("//") ? v : fb);

export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const f = await req.formData();
  const name = params.name;
  const next = safeNext(str(f, "next"), "/dashboard");
  try {
    // ---------- 인증 ----------
    if (name === "signup") {
      const email = str(f, "email").toLowerCase(), nm = str(f, "name"), pw = String(f.get("password") ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Fail("이메일 형식을 확인해주세요.");
      if (nm.length < 1 || nm.length > 30) throw new Fail("이름은 1~30자로 입력해주세요.");
      if (pw.length < 8 || pw.length > 72) throw new Fail("비밀번호는 8~72자여야 해요.");
      const hash = await bcrypt.hash(pw, 10);
      const id = (await q<{ auth_register: string }>(null, "select auth_register($1,$2,$3)", [email, nm, hash]))[0].auth_register;
      return await startSession(id, next);
    }
    if (name === "login") {
      const email = str(f, "email").toLowerCase(), pw = String(f.get("password") ?? "");
      const rec = fails.get(email);
      if (rec && Date.now() - rec.t < 600000 && rec.n >= 5) throw new Fail("로그인 시도가 너무 많아요. 10분 뒤 다시 시도해주세요.");
      const row = (await q<{ id: string; pw_hash: string }>(null, "select * from auth_get_login($1)", [email]))[0];
      const ok = await bcrypt.compare(pw, row?.pw_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
      if (!row || !ok) {
        fails.set(email, { n: (rec && Date.now() - rec.t < 600000 ? rec.n : 0) + 1, t: Date.now() });
        throw new Fail("이메일 또는 비밀번호가 올바르지 않아요.");
      }
      fails.delete(email);
      return await startSession(row.id, next);
    }
    if (name === "logout") {
      const token = req.cookies.get(COOKIE)?.value;
      if (token) await q(null, "select auth_delete_session($1)", [sha256(token)]);
      const res = go("/", "msg", "로그아웃했어요.");
      res.headers.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      return res;
    }

    // ---------- 이하 로그인 필요 ----------
    const user = await getUser();
    if (!user) return go("/login", "err", "로그인이 필요해요.", { next });
    const uid = user.id;
    const run = <T,>(sql: string, p: unknown[]) => q<T & Record<string, unknown>>(uid, sql, p);

    switch (name) {
      case "crew_create": {
        const r = await run<{ create_crew: string }>("select create_crew($1,$2,$3)", [str(f, "name"), str(f, "intro"), str(f, "theme")]);
        return go(`/crews/${r[0].create_crew}`, "msg", "크루를 만들었어요! 초대 링크를 공유해보세요.");
      }
      case "crew_update":
        await run("select update_crew($1,$2,$3,$4)", [str(f, "crew"), str(f, "name"), str(f, "intro"), str(f, "theme")]);
        return go(next, "msg", "크루 정보를 저장했어요.");
      case "crew_join": {
        const r = await run<{ join_crew: string }>("select join_crew($1)", [str(f, "code")]);
        return go(`/crews/${r[0].join_crew}`, "msg", "크루에 가입했어요. 환영해요!");
      }
      case "member_role":
        await run("select set_member_role($1,$2,$3)", [str(f, "crew"), str(f, "user"), str(f, "role")]);
        return go(next, "msg", "역할을 변경했어요.");
      case "set_plan":
        await run("select set_plan($1,$2)", [str(f, "crew"), str(f, "plan")]);
        return go(next, "msg", "모의 구독 상태를 변경했어요. (학습용 데모 · 실제 결제 없음)");
      case "event_create":
      case "event_update": {
        const iso = kstInputToISO(str(f, "starts_at"));
        if (!iso) throw new Fail("일시를 입력해주세요.");
        const cap = parseInt(str(f, "capacity"), 10);
        if (!Number.isInteger(cap)) throw new Fail("정원을 숫자로 입력해주세요.");
        if (name === "event_create") {
          const r = await run<{ create_event: string }>("select create_event($1,$2,$3,$4,$5,$6)", [
            str(f, "crew"), str(f, "title"), str(f, "description"), str(f, "location"), iso, cap]);
          return go(`/events/${r[0].create_event}`, "msg", "모임을 만들었어요.");
        }
        await run("select update_event($1,$2,$3,$4,$5,$6)", [
          str(f, "event"), str(f, "title"), str(f, "description"), str(f, "location"), iso, cap]);
        return go(next, "msg", "모임을 수정했어요.");
      }
      case "register": {
        const r = await run<{ register_event: string }>("select register_event($1)", [str(f, "event")]);
        const st = r[0].register_event;
        return go(next, "msg", st === "attending" ? "참석이 확정됐어요! 🎉" : "정원이 가득 차 대기 명단에 올랐어요.", st === "attending" ? { party: "1" } : {});
      }
      case "cancel":
        await run("select cancel_registration($1)", [str(f, "event")]);
        return go(next, "msg", "신청을 취소했어요.");
      case "checkin":
        await run("select check_in($1,$2,$3)", [str(f, "event"), str(f, "user"), str(f, "flag") === "1"]);
        return go(next, "msg", "출석을 반영했어요.");
      case "react":
        await run("select toggle_reaction($1,$2)", [str(f, "event"), str(f, "emoji")]);
        return go(next, "msg");
      case "review":
        await run("select post_review($1,$2)", [str(f, "event"), str(f, "body")]);
        return go(next, "msg", "소감을 남겼어요.");
      case "read_all":
        await run("select mark_notifications_read()", []);
        return go("/notifications", "msg");
    }
    return go("/dashboard", "err", "알 수 없는 요청이에요.");
  } catch (e) {
    const msg = e instanceof Fail ? e.message : errMessage(e);
    const back = name === "signup" ? "/signup" : name === "login" ? "/login" : next;
    return go(back, "err", msg, name === "login" || name === "signup" ? { next } : {});
  }
}

async function startSession(userId: string, next: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await q(null, "select auth_create_session($1,$2,$3)", [userId, sha256(token), 24 * 14]);
  const res = go(next, "msg");
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`
  );
  return res;
}
