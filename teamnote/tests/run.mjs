// 컨테이너 안에서 실행: docker compose exec web node tests/run.mjs
import pg from "pg";
import assert from "node:assert/strict";

pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v));
const APP = process.env.DATABASE_URL;
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SCHEMA = process.env.OWNER_DATABASE_URL ? "" : "teamnote.";
const tag = Math.random().toString(36).slice(2, 8);
const pool = new pg.Pool({ connectionString: APP, max: 40, ssl: /supabase\.(com|co)/.test(APP) ? { rejectUnauthorized: false } : undefined });
let pass = 0, fail = 0;
const results = [];
const t = async (name, fn) => {
  try { await fn(); pass++; results.push(`PASS  ${name}`); } catch (e) { fail++; results.push(`FAIL  ${name}\n      ${e.message}`); }
};
async function as(uid, sql, p = []) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.user_id',$1,true)", [uid ?? ""]);
    const r = await c.query(sql, p);
    await c.query("commit");
    return r.rows;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}
async function admin(sql) {
  if (process.env.OWNER_DATABASE_URL) {
    const c = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL }); await c.connect(); await c.query(sql); await c.end();
  } else {
    const r = await fetch(`https://api.supabase.com/v1/projects/${process.env.SB_REF}/database/query`, { method: "POST",
      headers: { Authorization: `Bearer ${process.env.SB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
    if (!r.ok) throw new Error("admin sql failed " + r.status);
  }
}
const reg = async (n) => (await as(null, "select auth_register($1,$2,'x')", [`${tag}-${n}@t.local`, `u${n}`]))[0].auth_register;
const rejects = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail("expected rejection " + re); };
const fmt = (d) => d.toISOString().slice(0, 10);
const kstToday = () => new Date(Date.now() + 9 * 3600e3);
// 오늘 이후 n번째 평일(같은 해)
function weekdays(n) {
  const out = []; const d = kstToday();
  while (out.length < n) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) out.push(fmt(d)); }
  return out;
}
const WD = weekdays(12);
if (WD.some((x) => x.slice(0, 4) !== WD[0].slice(0, 4))) { console.log("연말 경계: 테스트를 연초에 다시 실행해주세요"); process.exit(2); }
const year = Number(WD[0].slice(0, 4));

const owner = await reg("owner"), appr = await reg("appr"), m1 = await reg("m1"), m2 = await reg("m2"), out = await reg("out");
const teamA = (await as(owner, "select create_team('A팀', 5)", []))[0].create_team;
const teamB = (await as(out, "select create_team('B팀', 15)", []))[0].create_team;
const codeA = (await as(owner, "select invite_code from teams where id=$1", [teamA]))[0].invite_code;
for (const u of [appr, m1, m2]) await as(u, "select join_team($1)", [codeA]);
await as(owner, "select set_member_role($1,$2,'staff')", [teamA, appr]);

await t("다른 팀 데이터 접근 차단(RLS)", async () => {
  assert.equal((await as(out, "select * from teams where id=$1", [teamA])).length, 0);
  assert.equal((await as(out, "select * from team_members where team_id=$1", [teamA])).length, 0);
  await rejects(as(out, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[0]]), /forbidden/);
  await rejects(as(out, "select set_attendance($1,'office')", [teamA]), /forbidden/);
  await rejects(as(out, "select * from team_calendar($1,$2::date,$3::date)", [teamA, WD[0], WD[5]]), /forbidden/);
  await rejects(as(out, "select * from leave_balance($1,$2,$3)", [teamA, m1, year]), /forbidden/);
});

await t("직접 쓰기·세션 접근 차단, 앱 계정 비슈퍼유저", async () => {
  await rejects(as(m1, "update teams set annual_days = 60 where id=$1", [teamA]), /permission denied/);
  await rejects(as(m1, "update team_members set role='owner'"), /permission denied/);
  await rejects(as(m1, "insert into leave_requests(team_id,user_id,kind,start_date,end_date,days) values ($1,$2,'full',now(),now(),1)", [teamA, m1]), /permission denied/);
  await rejects(as(null, "select * from sessions"), /permission denied/);
  const r = (await as(null, "select rolsuper, rolbypassrls from pg_roles where rolname = current_user"))[0];
  assert.equal(r.rolsuper, false); assert.equal(r.rolbypassrls, false);
});

await t("권한: 팀원은 설정·지급일수·승인 불가, 사유는 타 팀원에게 비공개", async () => {
  await rejects(as(m1, "select update_team($1,'x팀',30)", [teamA]), /forbidden/);
  await rejects(as(m1, "select set_member_allowance($1,$2,30)", [teamA, m1]), /forbidden/);
  await rejects(as(appr, "select set_member_allowance($1,$2,30)", [teamA, m1]), /forbidden/);
  await rejects(as(m1, "select set_member_role($1,$2,'staff')", [teamA, m2]), /forbidden/);
  const id = (await as(m1, "select request_leave($1,'full',$2::date,$2::date,'비밀 사유')", [teamA, WD[10]]))[0].request_leave;
  assert.equal((await as(m2, "select * from leave_requests where id=$1", [id])).length, 0);
  assert.equal((await as(appr, "select * from leave_requests where id=$1", [id])).length, 1);
  await rejects(as(m2, "select decide_leave($1,true,'')", [id]), /forbidden/);
  const cal = await as(m2, "select * from team_calendar($1,$2::date,$3::date)", [teamA, WD[0], WD[11]]);
  assert.equal(cal.length, 0); // 아직 승인 전
  await rejects(as(appr, "select decide_leave($1,true,'')", [id]), /forbidden/);
  await rejects(as(appr, "select decide_leave($1,false,'')", [id]), /forbidden/);
  await as(owner, "select decide_leave($1,true,'ok')", [id]);
  const cal2 = await as(m2, "select * from team_calendar($1,$2::date,$3::date)", [teamA, WD[0], WD[11]]);
  assert.equal(cal2.length, 1); assert.equal(cal2[0].reason, undefined);
  await rejects(as(owner, "select decide_leave($1,false,'')", [id]), /already_decided/);
});

await t("운영자는 본인/다른 사람 승인 불가, 관리자만 승인 가능", async () => {
  const id = (await as(appr, "select request_leave($1,'half_am',$2::date,$2::date,'')", [teamA, WD[9]]))[0].request_leave;
  await rejects(as(appr, "select decide_leave($1,true,'')", [id]), /forbidden/);
  await as(owner, "select decide_leave($1,true,'')", [id]);
  const id2 = (await as(owner, "select request_leave($1,'half_pm',$2::date,$2::date,'')", [teamA, WD[9]]))[0].request_leave;
  await as(owner, "select decide_leave($1,true,'')", [id2]);
});

await t("개별 지급일수 지정과 잔여 계산", async () => {
  await as(owner, "select set_member_allowance($1,$2,3)", [teamA, m2]);
  assert.equal((await as(m2, "select * from leave_balance($1,$2,$3)", [teamA, m2, year]))[0].allowance, 3);
  assert.equal((await as(m1, "select * from leave_balance($1,$2,$3)", [teamA, m1, year]))[0].allowance, 5); // 팀 기본값
  await as(owner, "select set_member_allowance($1,$2,NULL)", [teamA, m2]);
  assert.equal((await as(m2, "select * from leave_balance($1,$2,$3)", [teamA, m2, year]))[0].allowance, 5);
  await rejects(as(owner, "select set_member_allowance($1,$2,99)", [teamA, m2]), /check constraint/);
});

await t("동시 신청: 지급 5일에 1일씩 8건 동시 → 정확히 5건만 성공, 잔여 0", async () => {
  const u = await reg("conc");
  await as(u, "select join_team($1)", [codeA]);
  const rs = await Promise.allSettled(WD.slice(0, 8).map((d) => as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, d])));
  const ok = rs.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 5);
  assert.ok(rs.filter((r) => r.status === "rejected").every((r) => /insufficient_balance/.test(r.reason.message)));
  const b = (await as(u, "select * from leave_balance($1,$2,$3)", [teamA, u, year]))[0];
  assert.deepEqual([b.pending, b.remaining], [5, 0]);
});

await t("중복 클릭: 같은 기간 재신청·동일 알림 중복 없음, 겹침 차단", async () => {
  const u = await reg("dup");
  await as(u, "select join_team($1)", [codeA]);
  const rs = await Promise.allSettled(Array.from({ length: 6 }, () => as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[1]])));
  assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(rs.filter((r) => r.status === "rejected").every((r) => /overlap/.test(r.reason.message)));
  const n = (await as(appr, "select count(*)::int n from notifications where user_id=$1 and kind='leave_requested' and body like $2", [appr, "u" + "dup%"]))[0].n;
  assert.equal(n, 1);
});

await t("반차: 오전+오후 같은 날 허용, 같은 반차 중복 불가, 0.5일 차감", async () => {
  const u = await reg("half");
  await as(u, "select join_team($1)", [codeA]);
  await as(u, "select request_leave($1,'half_am',$2::date,$2::date,'')", [teamA, WD[2]]);
  await as(u, "select request_leave($1,'half_pm',$2::date,$2::date,'')", [teamA, WD[2]]);
  await rejects(as(u, "select request_leave($1,'half_am',$2::date,$2::date,'')", [teamA, WD[2]]), /overlap/);
  await rejects(as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[2]]), /overlap/);
  const b = (await as(u, "select * from leave_balance($1,$2,$3)", [teamA, u, year]))[0];
  assert.equal(b.pending, 1);
});

await t("주말 제외 계산·과거/연도걸침/주말 반차 검증", async () => {
  const u = await reg("wk");
  await as(u, "select join_team($1)", [codeA]);
  await as(owner, "select set_member_allowance($1,$2,20)", [teamA, u]);
  // 다음 월요일~다음 일요일 = 5일
  const d = kstToday(); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 7);
  const mon = fmt(d); d.setUTCDate(d.getUTCDate() + 6); const sun = fmt(d);
  if (mon.slice(0, 4) === sun.slice(0, 4)) {
    const id = (await as(u, "select request_leave($1,'full',$2::date,$3::date,'')", [teamA, mon, sun]))[0].request_leave;
    assert.equal((await as(u, "select days from leave_requests where id=$1", [id]))[0].days, 5);
  }
  const sat = new Date(Date.parse(mon + "T00:00:00Z") + 5 * 86400000); const satS = fmt(sat);
  await rejects(as(u, "select request_leave($1,'half_am',$2::date,$2::date,'')", [teamA, satS]), /no_workdays/);
  await rejects(as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, "2020-01-06"]), /past_date/);
  await rejects(as(u, "select request_leave($1,'full',$2::date,$3::date,'')", [teamA, `${year}-12-30`, `${year + 1}-01-02`]), /cross_year|past_date/);
});

await t("취소: 본인만, 멱등, 취소 후 잔여 복구, 반려 건 취소 불가", async () => {
  const u = await reg("can");
  await as(u, "select join_team($1)", [codeA]);
  const id = (await as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[3]]))[0].request_leave;
  await rejects(as(m1, "select cancel_leave($1)", [id]), /forbidden/);
  await Promise.all([1, 2, 3].map(() => as(u, "select cancel_leave($1)", [id])));
  const b = (await as(u, "select * from leave_balance($1,$2,$3)", [teamA, u, year]))[0];
  assert.equal(b.remaining, 5);
  const id2 = (await as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[4]]))[0].request_leave;
  await as(owner, "select decide_leave($1,false,'반려')", [id2]);
  await rejects(as(u, "select cancel_leave($1)", [id2]), /already_decided/);
  assert.equal((await as(u, "select remaining from leave_balance($1,$2,$3)", [teamA, u, year]))[0].remaining, 5);
});

await t("출석: 오늘 상태 기록·변경, 승인자 수정만 가능", async () => {
  const wkday = kstToday().getUTCDay();
  if (wkday === 0 || wkday === 6) {
    await rejects(as(m1, "select set_attendance($1,'office')", [teamA]), /weekend/);
    return;
  }
  await as(m1, "select set_attendance($1,'office')", [teamA]);
  await as(m1, "select set_attendance($1,'remote')", [teamA]);
  const cnt = (await as(m1, "select count(*)::int n, max(status) s from attendance where user_id=$1 and team_id=$2", [m1, teamA]))[0];
  assert.deepEqual([cnt.n, cnt.s], [1, "remote"]);
  await rejects(as(m1, "select set_attendance($1,'sleep')", [teamA]), /check constraint|invalid_status/);
  await rejects(as(m1, "select fix_attendance($1,$2,$3::date,'office')", [teamA, m2, fmt(kstToday())]), /forbidden/);
  await as(appr, "select fix_attendance($1,$2,$3::date,'field')", [teamA, m2, fmt(kstToday())]);
  assert.equal((await as(m2, "select status from attendance where user_id=$1", [m2]))[0].status, "field");
  await rejects(as(appr, "select fix_attendance($1,$2,$3::date,'office')", [teamA, m2, fmt(new Date(Date.now() + 5 * 86400000))]), /future_date/);
});

await t("승인된 종일 연차 당일에는 출석 체크 불가", async () => {
  const wkday = kstToday().getUTCDay();
  if (wkday === 0 || wkday === 6) return;
  const u = await reg("onleave");
  await as(u, "select join_team($1)", [codeA]);
  const id = (await as(u, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, fmt(kstToday())]))[0].request_leave;
  await as(owner, "select decide_leave($1,true,'')", [id]);
  await rejects(as(u, "select set_attendance($1,'office')", [teamA]), /on_leave/);
});

await t("종료 시각 이후 DB 쓰기 차단 후 복구", async () => {
  await admin(`update ${SCHEMA}service_state set closes_at = now() - interval '1 second'`);
  try {
    await rejects(reg("closed"), /service_closed/);
    await rejects(as(m1, "select request_leave($1,'full',$2::date,$2::date,'')", [teamA, WD[6]]), /service_closed/);
  } finally {
    await admin(`update ${SCHEMA}service_state set closes_at = '${process.env.RESTORE_CLOSES_AT || "2100-01-01T00:00:00Z"}'`);
  }
  await reg("reopened");
});

await t("HTTP: 가입→팀 생성→출석→연차 신청→승인, 타 사용자 접근 차단", async () => {
  const jar = {};
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const post = async (path, data, c = cookie) => {
    const res = await fetch(BASE + path, { method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: c() }, body: new URLSearchParams(data) });
    for (const sc of res.headers.getSetCookie?.() ?? []) { const [kv] = sc.split(";"); const [k, v] = kv.split("="); jar[k] = v; }
    return res;
  };
  const get = (path, c = cookie) => fetch(BASE + path, { redirect: "manual", headers: { Cookie: c() } });
  { const r = await get("/dashboard"); const b = await r.text(); assert.ok(r.status === 307 || /NEXT_REDIRECT|\/login/.test(b)); assert.ok(!/내 팀/.test(b)); }
  const su = await post("/api/act/start", { name: "웹팀장", next: "/dashboard" });
  assert.equal(su.status, 303); assert.ok(jar.cn_session);
  const tc = await post("/api/act/team_create", { name: "웹팀", annual_days: "10", next: "/teams/new" });
  const tp = tc.headers.get("location").split("?")[0];
  assert.match(tp, /^\/teams\/[0-9a-f-]{36}$/);
  const teamId = tp.split("/")[2];
  assert.equal((await get(tp)).status, 200);
  const wd = weekdays(1)[0];
  const lv = await post("/api/act/leave_request", { team: teamId, kind: "full", start_date: wd, end_date: wd, reason: "", next: tp });
  assert.match(lv.headers.get("location"), /msg=/);
  const body = await (await get(tp)).text();
  assert.match(body, /승인 대기/);
  const csv = await get(`/api/teams/${teamId}/csv/leaves`);
  assert.equal(csv.status, 200);
  const other = await fetch(BASE + "/api/act/start", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "타인" }) });
  const sc = other.headers.getSetCookie()[0].split(";")[0];
  const oc = () => sc;
  { const r = await get(tp, oc); const b = await r.text(); assert.ok(r.status === 404 || /NEXT_NOT_FOUND|404/.test(b)); assert.ok(!b.includes("웹팀")); }
  assert.equal((await get(`/api/teams/${teamId}/csv/leaves`, oc)).status, 403);
});

await pool.end();
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
