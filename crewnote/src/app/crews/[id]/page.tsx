import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { THEMES, fmtKST } from "@/lib/format";
import { CopyButton } from "@/components/Client";
import Flash, { SP } from "@/components/Flash";

const ROLE = { owner: "운영자", staff: "운영진", member: "멤버" } as Record<string, string>;
const PAGE = 20;

export default async function CrewPage({ params, searchParams }: SP & { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/crews/${params.id}`);
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const crew = (await q<any>(user.id, "select * from crews where id = $1", [params.id]))[0];
  if (!crew) notFound(); // RLS: 비멤버는 존재 여부도 알 수 없음
  const role = (await q<any>(user.id, "select crew_role($1) as r", [params.id]))[0].r as string;
  const staff = role === "owner" || role === "staff";
  const page = Math.max(0, parseInt(String(searchParams.p ?? "0"), 10) || 0);
  const events = await q<any>(user.id, `select e.id, e.title, e.starts_at, e.location, e.capacity,
      (select count(*)::int from registrations g where g.event_id = e.id and g.status = 'attending') as att,
      (select count(*)::int from registrations g where g.event_id = e.id and g.status = 'waitlist') as wait
      from events e where e.crew_id = $1 order by e.starts_at desc limit ${PAGE + 1} offset $2`, [params.id, page * PAGE]);
  const hasMore = events.length > PAGE;
  const members = await q<any>(user.id, `select u.id, u.name, m.role from crew_members m join users u on u.id = m.user_id
      where m.crew_id = $1 order by m.joined_at limit 100`, [params.id]);
  const now = Date.now();
  const invite = `/join/${crew.invite_code}`;
  return (
    <div data-t={crew.theme}>
      <div className="row sp">
        <h1>{THEMES[crew.theme]?.emoji} {crew.name}</h1>
        <span className="pill">{ROLE[role]} · {crew.plan === "pro" ? "Pro(모의)" : "Free"}</span>
      </div>
      <Flash sp={searchParams} />
      <p>{crew.intro || <span className="mute">아직 소개가 없어요.</span>}</p>

      {staff && (
        <div className="card" style={{ margin: "16px 0" }}>
          <h2>운영자 도구</h2>
          <div className="mute" style={{ wordBreak: "break-all" }}>초대 링크: <code>{invite}</code></div>
          <div className="row" style={{ marginTop: 10 }}>
            <CopyButton text={`${invite}`} label="초대 경로 복사" />
            <Link className="btn p sm" href={`/crews/${crew.id}/events/new`}>＋ 모임 만들기</Link>
            <a className="btn sm" href={`/api/crews/${crew.id}/csv/members`}>멤버 CSV</a>
            <a className="btn sm" href={`/api/crews/${crew.id}/csv/attendance`}>출석 CSV</a>
            {role === "owner" && <Link className="btn sm" href={`/crews/${crew.id}/billing`}>구독(모의)</Link>}
          </div>
        </div>
      )}

      <h2>모임</h2>
      {events.length === 0 ? (
        <div className="card empty">아직 모임이 없어요.{staff ? " 첫 모임을 만들어보세요!" : " 운영진이 곧 모임을 열 거예요."}</div>
      ) : (
        <div className="grid">
          {events.slice(0, PAGE).map((e) => {
            const past = new Date(e.starts_at).getTime() <= now;
            const full = e.att >= e.capacity;
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="card link">
                <div className="row sp"><b>{e.title}</b><span className={`pill ${past ? "" : full ? "warn" : "ok"}`}>{past ? "종료" : full ? "마감" : "모집 중"}</span></div>
                <div className="mute">{fmtKST(e.starts_at)} · 📍 {e.location || "장소 미정"}</div>
                <div>참석 <b>{e.att}/{e.capacity}</b>{e.wait > 0 && <> · 대기 {e.wait}</>}</div>
              </Link>
            );
          })}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        {page > 0 && <Link className="btn sm" href={`?p=${page - 1}`}>← 이전</Link>}
        {hasMore && <Link className="btn sm" href={`?p=${page + 1}`}>다음 →</Link>}
      </div>

      <h2 style={{ marginTop: 28 }}>멤버 {members.length}명</h2>
      <div className="card">
        {members.map((m) => (
          <div key={m.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{m.name} <span className="pill">{ROLE[m.role]}</span></span>
            {role === "owner" && m.role !== "owner" && (
              <form action="/api/act/member_role" method="post">
                <input type="hidden" name="crew" value={crew.id} /><input type="hidden" name="user" value={m.id} />
                <input type="hidden" name="next" value={`/crews/${crew.id}`} />
                <input type="hidden" name="role" value={m.role === "staff" ? "member" : "staff"} />
                <button className="btn sm">{m.role === "staff" ? "운영진 해제" : "운영진 지정"}</button>
              </form>
            )}
          </div>
        ))}
      </div>

      {role === "owner" && (
        <details className="card" style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>크루 정보 편집</summary>
          <form action="/api/act/crew_update" method="post">
            <input type="hidden" name="crew" value={crew.id} /><input type="hidden" name="next" value={`/crews/${crew.id}`} />
            <label htmlFor="n">이름</label><input id="n" name="name" defaultValue={crew.name} minLength={2} maxLength={40} required />
            <label htmlFor="t">테마</label>
            <select id="t" name="theme" defaultValue={crew.theme}><option value="running">🏃 러닝</option><option value="reading">📚 독서</option><option value="study">✏️ 스터디</option></select>
            <label htmlFor="i">소개</label><textarea id="i" name="intro" defaultValue={crew.intro} maxLength={500} />
            <div style={{ marginTop: 12 }}><button className="btn p">저장</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
