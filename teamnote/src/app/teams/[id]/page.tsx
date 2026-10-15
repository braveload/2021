import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { KIND_LABEL, LEAVE_STATE, ROLE_LABEL, STATUS_LABEL, fmtDate, todayKST } from "@/lib/format";
import { CopyButton } from "@/components/Client";
import Flash, { SP } from "@/components/Flash";

function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TeamPage({ params, searchParams }: SP & { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/teams/${params.id}`);
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const uid = user.id;
  const team = (await q<any>(uid, "select * from teams where id = $1", [params.id]))[0];
  if (!team) notFound(); // RLS: 비멤버는 존재 여부도 알 수 없음
  const role = (await q<any>(uid, "select team_role($1) as r", [params.id]))[0].r as string;
  const approver = role === "owner" || role === "staff";
  const canDecideLeave = role === "owner";
  const today = todayKST();
  const year = Number(today.slice(0, 4));
  const monthQ = typeof searchParams.m === "string" && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : today.slice(0, 7);
  const next = `/teams/${team.id}`;

  const bal = (await q<any>(uid, "select * from leave_balance($1,$2,$3)", [team.id, uid, year]))[0];
  const myToday = (await q<any>(uid, "select status from attendance where team_id=$1 and user_id=app_uid() and work_date=kst_today()", [team.id]))[0]?.status as string | undefined;
  const myLeaves = await q<any>(uid, `select * from leave_requests where team_id=$1 and user_id=app_uid()
      and status in ('pending','approved') and end_date >= kst_today() order by start_date limit 20`, [team.id]);
  const pending = canDecideLeave
    ? await q<any>(uid, `select l.*, u.name from leave_requests l join users u on u.id = l.user_id
        where l.team_id = $1 and l.status = 'pending' order by l.created_at limit 50`, [team.id])
    : [];
  const members = await q<any>(uid, `select u.id, u.name, m.role, m.allowance_override,
      (select a.status from attendance a where a.team_id = m.team_id and a.user_id = m.user_id and a.work_date = kst_today()) as today
      from team_members m join users u on u.id = m.user_id where m.team_id = $1 order by m.joined_at limit 200`, [team.id]);
  const monthStart = `${monthQ}-01`;
  const monthEnd = `${shiftMonth(monthQ, 1)}-01`;
  const cal = await q<any>(uid, "select * from team_calendar($1, $2::date, ($3::date - 1))", [team.id, monthStart, monthEnd]);
  const offToday = new Set(cal.filter((c: any) => c.kind === "full" && c.start_date <= today && c.end_date >= today).map((c: any) => c.user_id));
  const halfToday = new Map<string, string>(cal.filter((c: any) => c.kind !== "full" && c.start_date === today).map((c: any) => [c.user_id, c.kind]));
  const counts = { office: 0, remote: 0, field: 0, off: 0, none: 0 };
  for (const m of members) {
    if (offToday.has(m.id)) counts.off++;
    else if (m.today) (counts as any)[m.today]++;
    else counts.none++;
  }

  return (
    <div>
      <div className="row sp">
        <h1>🗓️ {team.name}</h1>
        <span className="pill">{ROLE_LABEL[role]}</span>
      </div>
      <Flash sp={searchParams} />

      <div className="card">
        <h2>오늘({fmtDate(today)}) 내 상태</h2>
        <div className="row">
          {(["office", "remote", "field"] as const).map((s) => (
            <form key={s} action="/api/act/attendance" method="post">
              <input type="hidden" name="team" value={team.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="next" value={next} />
              <button className={`btn react ${myToday === s ? "on p" : ""}`} aria-pressed={myToday === s}>{STATUS_LABEL[s]}</button>
            </form>
          ))}
        </div>
        <p className="mute" style={{ margin: "10px 0 0" }}>
          {myToday ? `현재: ${STATUS_LABEL[myToday]} (같은 날 다시 눌러 변경할 수 있어요)` : "아직 체크하지 않았어요."}
        </p>
      </div>

      <h2 style={{ margin: "24px 0 8px" }}>내 연차 ({year}년)</h2>
      <div className="grid">
        <div className="card"><div className="stat">{bal.allowance}</div><div className="mute">지급</div></div>
        <div className="card"><div className="stat">{bal.approved}</div><div className="mute">사용(승인)</div></div>
        <div className="card"><div className="stat">{bal.pending}</div><div className="mute">승인 대기</div></div>
        <div className="card"><div className="stat" style={{ color: bal.remaining <= 0 ? "var(--bad)" : undefined }}>{bal.remaining}</div><div className="mute">잔여</div></div>
      </div>

      <form action="/api/act/leave_request" method="post" className="card" style={{ marginTop: 16 }}>
        <h2>연차·반차 신청</h2>
        <input type="hidden" name="team" value={team.id} /><input type="hidden" name="next" value={next} />
        <label htmlFor="kind">종류</label>
        <select id="kind" name="kind"><option value="full">연차 (종일)</option><option value="half_am">오전 반차 (0.5일)</option><option value="half_pm">오후 반차 (0.5일)</option></select>
        <label htmlFor="sd">시작일</label><input id="sd" name="start_date" type="date" min={today} required />
        <label htmlFor="ed">종료일 (반차는 시작일과 같게 비워두세요)</label><input id="ed" name="end_date" type="date" min={today} />
        <label htmlFor="rs">사유 (선택, 관리자·운영자에게만 보여요)</label><input id="rs" name="reason" maxLength={200} />
        <p className="mute">토·일은 일수에서 제외돼요. 공휴일은 반영하지 않으니 직접 확인해주세요.</p>
        <div style={{ marginTop: 12 }}><button className="btn p full-m">신청하기</button></div>
      </form>

      {myLeaves.length > 0 && (
        <>
          <h2 style={{ margin: "24px 0 8px" }}>내 신청</h2>
          <div className="card">
            {myLeaves.map((l) => (
              <div key={l.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{KIND_LABEL[l.kind]} · {fmtDate(l.start_date)}{l.end_date !== l.start_date ? ` ~ ${fmtDate(l.end_date)}` : ""} · {l.days}일 <span className={`pill ${l.status === "approved" ? "ok" : "warn"}`}>{LEAVE_STATE[l.status]}</span></span>
                {(l.status === "pending" || l.start_date > today) && (
                  <form action="/api/act/leave_cancel" method="post">
                    <input type="hidden" name="leave" value={l.id} /><input type="hidden" name="next" value={next} />
                    <button className="btn sm d">취소</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {canDecideLeave && (
        <>
          <h2 style={{ margin: "24px 0 8px" }}>승인 대기 {pending.length}건</h2>
          {pending.length === 0 ? <div className="card empty">처리할 신청이 없어요.</div> : (
            <div style={{ display: "grid", gap: 10 }}>
              {pending.map((l) => (
                <div key={l.id} className="card">
                  <b>{l.name}</b> · {KIND_LABEL[l.kind]} · {fmtDate(l.start_date)}{l.end_date !== l.start_date ? ` ~ ${fmtDate(l.end_date)}` : ""} · {l.days}일
                  {l.reason && <div className="mute">사유: {l.reason}</div>}
                  <form action="/api/act/leave_decide" method="post" className="row" style={{ marginTop: 10 }}>
                    <input type="hidden" name="leave" value={l.id} /><input type="hidden" name="next" value={next} />
                    <input name="note" placeholder="메모(선택)" maxLength={200} style={{ flex: 1, minWidth: 140 }} />
                    <button name="approve" value="1" className="btn p sm">승인</button>
                    <button name="approve" value="0" className="btn sm d">반려</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <h2 style={{ margin: "24px 0 8px" }}>오늘 팀 현황</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="pill ok">🏢 출근 {counts.office}</span><span className="pill">🏠 재택 {counts.remote}</span>
        <span className="pill">🚗 외근 {counts.field}</span><span className="pill warn">🌴 연차 {counts.off}</span>
        <span className="pill bad">미체크 {counts.none}</span>
      </div>
      <div className="card">
        {members.map((m) => (
          <div key={m.id} className="row sp" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{m.name} <span className="pill">{ROLE_LABEL[m.role]}</span></span>
            <span className="row">
              <span className="mute">
                {offToday.has(m.id) ? "🌴 연차" : (halfToday.has(m.id) ? (halfToday.get(m.id) === "half_am" ? "오전 반차 · " : "오후 반차 · ") : "") + (m.today ? STATUS_LABEL[m.today] : "미체크")}
              </span>
              {approver && !offToday.has(m.id) && (
                <form action="/api/act/attendance_fix" method="post" className="row">
                  <input type="hidden" name="team" value={team.id} /><input type="hidden" name="user" value={m.id} />
                  <input type="hidden" name="date" value={today} /><input type="hidden" name="next" value={next} />
                  <select name="status" aria-label={`${m.name} 상태`} defaultValue={m.today ?? "office"} style={{ width: "auto", minHeight: 36 }}>
                    <option value="office">출근</option><option value="remote">재택</option><option value="field">외근</option>
                  </select>
                  <button className="btn sm">수정</button>
                </form>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="row sp" style={{ margin: "24px 0 8px" }}>
        <h2 style={{ margin: 0 }}>팀 캘린더 {monthQ}</h2>
        <span className="row">
          <Link className="btn sm" href={`?m=${shiftMonth(monthQ, -1)}`}>←</Link>
          <Link className="btn sm" href={`?m=${shiftMonth(monthQ, 1)}`}>→</Link>
        </span>
      </div>
      {cal.length === 0 ? <div className="card empty">이 달에 승인된 연차가 없어요.</div> : (
        <div className="card">
          {cal.map((c: any, i: number) => (
            <div key={i} className="row sp" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{c.name}</span>
              <span className="mute">{KIND_LABEL[c.kind]} · {fmtDate(c.start_date)}{c.end_date !== c.start_date ? ` ~ ${fmtDate(c.end_date)}` : ""} · {c.days}일</span>
            </div>
          ))}
        </div>
      )}

      {approver && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>팀 도구</h2>
          <div className="mute" style={{ wordBreak: "break-all" }}>초대 링크: <code>/join/{team.invite_code}</code></div>
          <div className="row" style={{ marginTop: 10 }}>
            <CopyButton text={`/join/${team.invite_code}`} label="초대 링크 복사" />
            <a className="btn sm" href={`/api/teams/${team.id}/csv/attendance?month=${monthQ}`}>출석 CSV({monthQ})</a>
            <a className="btn sm" href={`/api/teams/${team.id}/csv/leaves?month=${monthQ}`}>연차 CSV({monthQ})</a>
          </div>
        </div>
      )}

      {role === "owner" && (
        <>
          <details className="card" style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>팀 설정 · 지급일수</summary>
            <form action="/api/act/team_update" method="post">
              <input type="hidden" name="team" value={team.id} /><input type="hidden" name="next" value={next} />
              <label htmlFor="tn">팀 이름</label><input id="tn" name="name" defaultValue={team.name} minLength={2} maxLength={40} required />
              <label htmlFor="td">팀 기본 연간 지급일수</label>
              <input id="td" name="annual_days" type="number" inputMode="decimal" step="0.5" min="0" max="60" defaultValue={team.annual_days} required />
              <div style={{ marginTop: 12 }}><button className="btn p">저장</button></div>
            </form>
          </details>
          <details className="card" style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>팀원 관리 (역할 · 개별 지급일수)</summary>
            {members.map((m) => (
              <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row sp"><b>{m.name}</b><span className="pill">{ROLE_LABEL[m.role]}</span></div>
                <form action="/api/act/member_role" method="post" className="row" style={{ marginTop: 8 }}>
                  <input type="hidden" name="team" value={team.id} /><input type="hidden" name="user" value={m.id} />
                  <input type="hidden" name="next" value={next} />
                  <select name="role" aria-label={`${m.name} 역할`} defaultValue={m.role} style={{ width: "auto" }}>
                    <option value="owner">관리자</option><option value="staff">운영자</option><option value="member">팀원</option>
                  </select>
                  <button className="btn sm">역할 저장</button>
                </form>
                {m.role !== "owner" && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <form action="/api/act/member_allowance" method="post" className="row">
                      <input type="hidden" name="team" value={team.id} /><input type="hidden" name="user" value={m.id} /><input type="hidden" name="next" value={next} />
                      <input name="days" type="number" inputMode="decimal" step="0.5" min="0" max="60" placeholder={`기본 ${team.annual_days}`}
                        defaultValue={m.allowance_override ?? ""} aria-label={`${m.name} 지급일수`} style={{ width: 110, minHeight: 36 }} />
                      <button className="btn sm">지급일수 저장</button>
                    </form>
                  </div>
                )}
              </div>
            ))}
            <p className="mute">지급일수를 비우면 팀 기본값을 사용해요. 관리자는 여러 명 지정할 수 있으며 마지막 관리자는 해제할 수 없어요.</p>
          </details>
        </>
      )}
    </div>
  );
}
