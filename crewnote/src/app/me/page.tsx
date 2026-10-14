import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { BADGES, fmtKST } from "@/lib/format";

export default async function Me() {
  const user = await getUser();
  if (!user) redirect("/login");
  const s = (await q<any>(user.id, `select
      (select count(*)::int from registrations where user_id = app_uid() and checked_in) as attended,
      (select count(distinct e.crew_id)::int from registrations g join events e on e.id = g.event_id
         where g.user_id = app_uid() and g.checked_in) as crews,
      (select count(*)::int from reviews where user_id = app_uid()) as reviews,
      (select count(*)::int from registrations where user_id = app_uid() and status = 'attending'
         and not checked_in and event_id in (select id from events where starts_at < now())) as noshow`))[0];
  const hist = await q<any>(user.id, `select e.id, e.title, e.starts_at, c.name as crew, g.status, g.checked_in
      from registrations g join events e on e.id = g.event_id join crews c on c.id = e.crew_id
      where g.user_id = app_uid() and g.status <> 'cancelled' order by e.starts_at desc limit 30`);
  return (
    <div>
      <h1>내 참여 기록</h1>
      <div className="grid">
        <div className="card"><div className="stat">{s.attended}</div><div className="mute">출석한 모임</div></div>
        <div className="card"><div className="stat">{s.crews}</div><div className="mute">출석한 크루 수</div></div>
        <div className="card"><div className="stat">{s.reviews}</div><div className="mute">남긴 소감</div></div>
      </div>
      <h2 style={{ marginTop: 24 }}>활동 배지</h2>
      <p className="mute">실제 출석·소감 기록으로 계산돼요.</p>
      <div className="row">
        {BADGES.map((b) => {
          const on = b.need(s);
          return <div key={b.key} className={`badge ${on ? "on" : ""}`} title={b.desc}><b>{b.emoji}</b>{b.name}<span className="mute">{b.desc}</span></div>;
        })}
      </div>
      <h2 style={{ marginTop: 24 }}>기록</h2>
      {hist.length === 0 ? <div className="card empty">아직 참여 기록이 없어요.</div> : (
        <div className="card">
          {hist.map((h) => (
            <div key={h.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <Link href={`/events/${h.id}`}>{h.title}</Link>
              <span className="mute">{h.crew} · {fmtKST(h.starts_at, false)} · {h.checked_in ? "출석 ✓" : h.status === "waitlist" ? "대기" : "신청"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
