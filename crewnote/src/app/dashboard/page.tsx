import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { THEMES, fmtKST } from "@/lib/format";
import { Countdown } from "@/components/Client";
import Flash, { SP } from "@/components/Flash";

export default async function Dashboard({ searchParams }: SP) {
  const user = await getUser();
  if (!user) redirect("/login");
  await q(user.id, "select generate_reminders()");
  const crews = await q<any>(user.id, `select c.id, c.name, c.theme, m.role,
      (select count(*)::int from crew_members x where x.crew_id = c.id) as members
      from crew_members m join crews c on c.id = m.crew_id where m.user_id = app_uid() order by m.joined_at desc limit 50`);
  const nexts = await q<any>(user.id, `select e.id, e.title, e.starts_at, e.location, c.name as crew, g.status
      from registrations g join events e on e.id = g.event_id join crews c on c.id = e.crew_id
      where g.user_id = app_uid() and g.status in ('attending','waitlist') and e.starts_at > now()
      order by e.starts_at limit 5`);
  return (
    <div>
      <h1>안녕하세요, {user.name}님 👋</h1>
      <Flash sp={searchParams} />
      <h2>내 다음 모임</h2>
      {nexts.length === 0 ? (
        <div className="card empty">신청한 다가오는 모임이 없어요.<br />크루에서 모임을 찾아보세요.</div>
      ) : (
        <div className="grid">
          {nexts.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card link">
              <div className="row sp"><b>{e.title}</b><span className={`pill ${e.status === "attending" ? "ok" : "warn"}`}>{e.status === "attending" ? "참석" : "대기"}</span></div>
              <div className="mute">{e.crew} · {fmtKST(e.starts_at)}</div>
              <div className="mute">📍 {e.location || "장소 미정"}</div>
              <div>⏳ <Countdown to={e.starts_at} /></div>
            </Link>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 28 }}>내 크루</h2>
      {crews.length === 0 ? (
        <div className="card empty">
          아직 속한 크루가 없어요.<br />
          <Link className="btn p" href="/crews/new" style={{ marginTop: 12 }}>첫 크루 만들기</Link>
        </div>
      ) : (
        <div className="grid">
          {crews.map((c) => (
            <Link key={c.id} href={`/crews/${c.id}`} className="card link" data-t={c.theme}>
              <div style={{ fontSize: "1.6rem" }}>{THEMES[c.theme]?.emoji}</div>
              <b>{c.name}</b>
              <div className="mute">{THEMES[c.theme]?.label} · 멤버 {c.members}명</div>
              <span className="pill">{c.role === "owner" ? "운영자" : c.role === "staff" ? "운영진" : "멤버"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
