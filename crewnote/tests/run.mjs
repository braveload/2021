// 컨테이너 안에서 실행: docker compose exec web node tests/run.mjs
import pg from "pg";
import assert from "node:assert/strict";

const APP = process.env.DATABASE_URL;
const BASE = "http://127.0.0.1:3000";
const tag = Math.random().toString(36).slice(2, 8);
const pool = new pg.Pool({ connectionString: APP, max: 40 });
let pass = 0, fail = 0;
const results = [];

async function t(name, fn) {
  try { await fn(); pass++; results.push(`PASS  ${name}`); }
  catch (e) { fail++; results.push(`FAIL  ${name}\n      ${e.message}`); }
}
// 사용자 컨텍스트로 한 문장 실행 (RLS 적용)
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
const reg = async (n) => (await as(null, "select auth_register($1,$2,'x')", [`${tag}-${n}@t.local`, `u${n}`]))[0].auth_register;
const rejects = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail("expected rejection " + re); };
const future = () => new Date(Date.now() + 5 * 86400000).toISOString();

const owner = await reg("owner");
const staff = await reg("staff");
const outsider = await reg("out");
const crewA = (await as(owner, "select create_crew('A크루','','running')"))[0].create_crew;
const crewB = (await as(outsider, "select create_crew('B크루','','study')"))[0].create_crew;
const codeA = (await as(owner, "select invite_code from crews where id=$1", [crewA]))[0].invite_code;

await t("다른 크루 데이터 접근 차단(RLS)", async () => {
  assert.equal((await as(outsider, "select * from crews where id=$1", [crewA])).length, 0);
  assert.equal((await as(outsider, "select * from crew_members where crew_id=$1", [crewA])).length, 0);
  const ev = (await as(owner, "select create_event($1,'비공개 모임','','',$2,5)", [crewA, future()]))[0].create_event;
  assert.equal((await as(outsider, "select * from events where id=$1", [ev])).length, 0);
  await rejects(as(outsider, "select register_event($1)", [ev]), /forbidden/);
});

await t("직접 쓰기 차단(권한·RLS): 일반 사용자가 plan/role 변경 불가", async () => {
  await rejects(as(owner, "update crews set plan='pro' where id=$1", [crewA]), /permission denied/);
  await rejects(as(owner, "update crew_members set role='owner'", []), /permission denied/);
  await rejects(as(null, "select * from sessions"), /permission denied/);
});

await t("멤버 가입은 초대코드로만, 비멤버는 모임 생성 불가", async () => {
  await rejects(as(outsider, "select create_event($1,'x모임','','',$2,5)", [crewA, future()]), /forbidden/);
  await as(staff, "select join_crew($1)", [codeA]);
  await rejects(as(staff, "select create_event($1,'x모임','','',$2,5)", [crewA, future()]), /forbidden/);
  await as(owner, "select set_member_role($1,$2,'staff')", [crewA, staff]);
  await as(staff, "select create_event($1,'운영진 모임','','',$2,5)", [crewA, future()]);
  await rejects(as(staff, "select set_member_role($1,$2,'member')", [crewA, owner]), /forbidden/);
  await rejects(as(staff, "select set_plan($1,'pro')", [crewA]), /forbidden/);
});

// 무료 크루: 35명 동시 가입 → 30명(운영자 포함)만 허용
await t("멤버 수 제한 30명을 동시 가입에서도 DB가 유지", async () => {
  const crew = (await as(owner, "select create_crew('한도크루','','study')"))[0].create_crew;
  const code = (await as(owner, "select invite_code from crews where id=$1", [crew]))[0].invite_code;
  const users = await Promise.all(Array.from({ length: 35 }, (_, i) => reg(`lim${i}`)));
  const rs = await Promise.allSettled(users.map((u) => as(u, "select join_crew($1)", [code])));
  const ok = rs.filter((r) => r.status === "fulfilled").length;
  const cnt = (await as(owner, "select count(*)::int n from crew_members where crew_id=$1", [crew]))[0].n;
  assert.equal(cnt, 30); assert.equal(ok, 29);
  assert.ok(rs.filter((r) => r.status === "rejected").every((r) => /member_limit/.test(r.reason.message)));
});

// 정원 5명 모임에 30명 동시 신청
const bigCrew = (await as(owner, "select create_crew('동시성크루','','running')"))[0].create_crew;
await as(owner, "select set_plan($1,'pro')", [bigCrew]);
const bigCode = (await as(owner, "select invite_code from crews where id=$1", [bigCrew]))[0].invite_code;
const people = await Promise.all(Array.from({ length: 30 }, (_, i) => reg(`p${i}`)));
await Promise.all(people.map((u) => as(u, "select join_crew($1)", [bigCode])));
const evt = (await as(owner, "select create_event($1,'정원5 모임','','',$2,5)", [bigCrew, future()]))[0].create_event;

await t("정원 5명에 30명 동시 신청 → 참석 5 / 대기 25, 순번 유일", async () => {
  await Promise.all(people.map((u) => as(u, "select register_event($1)", [evt])));
  const r = (await as(owner, `select count(*) filter (where status='attending')::int a,
     count(*) filter (where status='waitlist')::int w, count(distinct seq)::int s from registrations where event_id=$1`, [evt]))[0];
  assert.deepEqual(r, { a: 5, w: 25, s: 30 });
});

await t("중복 클릭·재시도: 신청 중복·알림 중복 없음", async () => {
  const u = people[0];
  await Promise.all(Array.from({ length: 8 }, () => as(u, "select register_event($1)", [evt])));
  const n = (await as(u, "select count(*)::int n from registrations where event_id=$1 and user_id=$2", [evt, u]))[0].n;
  assert.equal(n, 1);
  const k = (await as(u, "select count(*)::int n from notifications where user_id=$1 and event_id=$2 and kind='registered'", [u, evt]))[0].n;
  assert.equal(k, 1);
});

await t("참석자 1명 취소 → 대기 1번만 승급, 알림 1건, 재취소 멱등", async () => {
  const att = (await as(owner, "select user_id from registrations where event_id=$1 and status='attending' limit 1", [evt]))[0].user_id;
  const first = (await as(owner, "select user_id from registrations where event_id=$1 and status='waitlist' order by seq limit 1", [evt]))[0].user_id;
  await Promise.all([1, 2, 3].map(() => as(att, "select cancel_registration($1)", [evt])));
  const r = (await as(owner, `select count(*) filter (where status='attending')::int a, count(*) filter (where status='waitlist')::int w
    from registrations where event_id=$1`, [evt]))[0];
  assert.deepEqual(r, { a: 5, w: 24 });
  assert.equal((await as(owner, "select status from registrations where event_id=$1 and user_id=$2", [evt, first]))[0].status, "attending");
  const n = (await as(first, "select count(*)::int n from notifications where user_id=$1 and kind='promoted'", [first]))[0].n;
  assert.equal(n, 1);
});

await t("취소 후 재신청 시 대기 맨 뒤로", async () => {
  const w = (await as(owner, "select user_id from registrations where event_id=$1 and status='waitlist' order by seq limit 1", [evt]))[0].user_id;
  await as(w, "select cancel_registration($1)", [evt]);
  assert.equal((await as(w, "select register_event($1)", [evt]))[0].register_event, "waitlist");
  const last = (await as(owner, "select user_id from registrations where event_id=$1 and status='waitlist' order by seq desc limit 1", [evt]))[0].user_id;
  assert.equal(last, w);
});

await t("시작된 모임은 신청·취소·수정 불가", async () => {
  const c = await pool.connect(); // 소유자 연결이 아닌 앱 계정으로는 과거 이벤트 생성 불가 → 시간 경과를 직접 시뮬레이션
  c.release();
  const owner_url = process.env.OWNER_DATABASE_URL;
  const oc = new pg.Client({ connectionString: owner_url }); await oc.connect();
  await oc.query("update events set starts_at = now() - interval '1 hour' where id=$1", [evt]);
  await oc.end();
  await rejects(as(people[29], "select register_event($1)", [evt]), /event_started/);
  await rejects(as(people[29], "select cancel_registration($1)", [evt]), /event_started/);
  await rejects(as(owner, "select update_event($1,'제목바꿈','','',$2,5)", [evt, future()]), /event_started/);
});

await t("출석 체크: 운영진만, 참석 확정자만 / 소감은 출석자만", async () => {
  const att = (await as(owner, "select user_id from registrations where event_id=$1 and status='attending' limit 1", [evt]))[0].user_id;
  const wl = (await as(owner, "select user_id from registrations where event_id=$1 and status='waitlist' limit 1", [evt]))[0].user_id;
  await rejects(as(att, "select check_in($1,$2,true)", [evt, att]), /forbidden/);
  await rejects(as(owner, "select check_in($1,$2,true)", [evt, wl]), /not_attending/);
  await rejects(as(att, "select post_review($1,'좋았어요')", [evt]), /not_attended/);
  await as(owner, "select check_in($1,$2,true)", [evt, att]);
  await as(att, "select post_review($1,'좋았어요')", [evt]);
  assert.equal((await as(att, "select count(*)::int n from reviews where event_id=$1", [evt]))[0].n, 1);
});

await t("앱 DB 계정은 superuser가 아니고 RLS 우회 불가", async () => {
  const r = (await as(null, "select rolsuper, rolbypassrls from pg_roles where rolname = current_user"))[0];
  assert.equal(r.rolsuper, false); assert.equal(r.rolbypassrls, false);
});

// ---- HTTP 흐름 (쿠키 포함) ----
await t("HTTP: 가입→로그인→크루 생성→모임→신청, 비로그인 차단", async () => {
  const jar = {};
  const post = async (path, data) => {
    const res = await fetch(BASE + path, {
      method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
      body: new URLSearchParams(data),
    });
    for (const sc of res.headers.getSetCookie?.() ?? []) { const [kv] = sc.split(";"); const [k, v] = kv.split("="); jar[k] = v; }
    return res;
  };
  const get = (path) => fetch(BASE + path, { redirect: "manual", headers: { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") } });
  { const r = await get("/dashboard"); const b = await r.text(); assert.ok(r.status === 307 || /NEXT_REDIRECT|\/login/.test(b)); assert.ok(!/내 다음 모임/.test(b)); }
  const bad = await post("/api/act/login", { email: "nobody@t.local", password: "wrongwrong" });
  assert.match(bad.headers.get("location"), /err=/);
  const su = await post("/api/act/signup", { name: "웹유저", email: `${tag}-web@t.local`, password: "password123", next: "/dashboard" });
  assert.equal(su.status, 303); assert.ok(jar.cn_session);
  assert.equal((await get("/dashboard")).status, 200);
  const cc = await post("/api/act/crew_create", { name: "웹크루", theme: "reading", intro: "소개", next: "/crews/new" });
  const crewPath = cc.headers.get("location").split("?")[0];
  assert.match(crewPath, /^\/crews\/[0-9a-f-]{36}$/);
  assert.equal((await get(crewPath)).status, 200);
  const crewId = crewPath.split("/")[2];
  const dt = new Date(Date.now() + 2 * 86400000 + 9 * 3600000).toISOString().slice(0, 16);
  const ev = await post("/api/act/event_create", { crew: crewId, title: "웹 모임", location: "강남", starts_at: dt, capacity: "2", description: "", next: "/x" });
  const evPath = ev.headers.get("location").split("?")[0];
  assert.match(evPath, /^\/events\//);
  const rg = await post("/api/act/register", { event: evPath.split("/")[2], next: evPath });
  assert.match(rg.headers.get("location"), /party=1/);
  assert.equal((await get(evPath)).status, 200);
  const ics = await get(`/api${evPath}/ics`);
  assert.equal(ics.status, 200); assert.match(await ics.text(), /BEGIN:VCALENDAR/);
  const csv = await get(`/api/crews/${crewId}/csv/members`);
  assert.equal(csv.status, 200);
  // 다른 사용자(비멤버)는 크루 페이지 404, CSV 403
  const jar2 = {};
  const r2 = await fetch(BASE + "/api/act/signup", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name: "타인", email: `${tag}-other@t.local`, password: "password123" }) });
  const sc = r2.headers.getSetCookie()[0].split(";")[0];
  const other = (p) => fetch(BASE + p, { redirect: "manual", headers: { Cookie: sc } });
  { const r = await other(crewPath); const b = await r.text(); assert.ok(r.status === 404 || /NEXT_NOT_FOUND|404/.test(b)); assert.ok(!b.includes("웹크루")); }
  assert.equal((await other(`/api/crews/${crewId}/csv/members`)).status, 403);
  { const r = await other(evPath); const b = await r.text(); assert.ok(r.status === 404 || /NEXT_NOT_FOUND|404/.test(b)); assert.ok(!b.includes("웹 모임")); }
});

await pool.end();
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
