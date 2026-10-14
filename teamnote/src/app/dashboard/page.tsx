import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { KIND_LABEL, LEAVE_STATE, ROLE_LABEL, STATUS_LABEL, fmtDate } from "@/lib/format";
import Flash, { SP } from "@/components/Flash";

export default async function Dashboard({ searchParams }: SP) {
  const user = await getUser();
  if (!user) redirect("/login");
  const teams = await q<any>(user.id, `select t.id, t.name, m.role,
      (select count(*)::int from team_members x where x.team_id = t.id) as members,
      (select a.status from attendance a where a.team_id = t.id and a.user_id = app_uid() and a.work_date = kst_today()) as today,
      (select count(*)::int from leave_requests l where l.team_id = t.id and l.status = 'pending'
         and m.role in ('owner','staff') and l.user_id <> app_uid()) as to_approve
      from team_members m join teams t on t.id = m.team_id where m.user_id = app_uid() order by m.joined_at desc limit 50`);
  const mine = await q<any>(user.id, `select l.id, l.kind, l.start_date, l.end_date, l.days, l.status, t.name as team, t.id as team_id
      from leave_requests l join teams t on t.id = l.team_id
      where l.user_id = app_uid() and l.status in ('pending','approved') and l.end_date >= kst_today()
      order by l.start_date limit 5`);
  return (
    <div>
      <h1>안녕하세요, {user.name}님 👋</h1>
      <Flash sp={searchParams} />
      <h2>내 팀</h2>
      {teams.length === 0 ? (
        <div className="card empty">아직 속한 팀이 없어요.<br />
          <Link className="btn p" href="/teams/new" style={{ marginTop: 12 }}>팀 만들기</Link>
        </div>
      ) : (
        <div className="grid">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`} className="card link">
              <div className="row sp"><b>{t.name}</b><span className="pill">{ROLE_LABEL[t.role]}</span></div>
              <div className="mute">팀원 {t.members}명</div>
              <div>오늘: {t.today ? STATUS_LABEL[t.today] : <span className="mute">아직 체크 전</span>}</div>
              {t.to_approve > 0 && <span className="pill warn">승인 대기 {t.to_approve}건</span>}
            </Link>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 28 }}>내 다음 연차</h2>
      {mine.length === 0 ? <div className="card empty">예정된 연차가 없어요.</div> : (
        <div className="card">
          {mine.map((l) => (
            <div key={l.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <Link href={`/teams/${l.team_id}`}>{l.team} · {KIND_LABEL[l.kind]}</Link>
              <span className="mute">{fmtDate(l.start_date)}{l.end_date !== l.start_date ? ` ~ ${fmtDate(l.end_date)}` : ""} · {l.days}일 · <span className={`pill ${l.status === "approved" ? "ok" : "warn"}`}>{LEAVE_STATE[l.status]}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
