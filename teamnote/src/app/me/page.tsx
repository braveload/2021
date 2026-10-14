import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { KIND_LABEL, LEAVE_STATE, STATUS_LABEL, fmtDate } from "@/lib/format";

export default async function Me() {
  const user = await getUser();
  if (!user) redirect("/login");
  const month = (await q<any>(user.id, `select
      count(*) filter (where status = 'office')::int as office,
      count(*) filter (where status = 'remote')::int as remote,
      count(*) filter (where status = 'field')::int as field
      from attendance where user_id = app_uid() and date_trunc('month', work_date) = date_trunc('month', kst_today())`))[0];
  const leaves = await q<any>(user.id, `select l.id, l.kind, l.start_date, l.end_date, l.days, l.status, l.decision_note, t.name as team, t.id as team_id
      from leave_requests l join teams t on t.id = l.team_id where l.user_id = app_uid()
      order by l.start_date desc limit 50`);
  const recent = await q<any>(user.id, `select a.work_date, a.status, t.name as team from attendance a join teams t on t.id = a.team_id
      where a.user_id = app_uid() order by a.work_date desc limit 14`);
  return (
    <div>
      <h1>내 기록</h1>
      <div className="grid">
        <div className="card"><div className="stat">{month.office}</div><div className="mute">이번 달 출근</div></div>
        <div className="card"><div className="stat">{month.remote}</div><div className="mute">이번 달 재택</div></div>
        <div className="card"><div className="stat">{month.field}</div><div className="mute">이번 달 외근</div></div>
      </div>
      <h2 style={{ marginTop: 24 }}>연차 내역</h2>
      {leaves.length === 0 ? <div className="card empty">연차 신청 내역이 없어요.</div> : (
        <div className="card">
          {leaves.map((l) => (
            <div key={l.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <Link href={`/teams/${l.team_id}`}>{l.team} · {KIND_LABEL[l.kind]}</Link>
              <span className="mute">{fmtDate(l.start_date)}{l.end_date !== l.start_date ? ` ~ ${fmtDate(l.end_date)}` : ""} · {l.days}일 · {LEAVE_STATE[l.status]}{l.decision_note ? ` (${l.decision_note})` : ""}</span>
            </div>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 24 }}>최근 출석</h2>
      {recent.length === 0 ? <div className="card empty">아직 출석 기록이 없어요.</div> : (
        <div className="card">
          {recent.map((a, i) => (
            <div key={i} className="row sp" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{fmtDate(a.work_date)}</span><span className="mute">{a.team} · {STATUS_LABEL[a.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
