import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { EMOJIS, fmtKST, toKstInput } from "@/lib/format";
import { Countdown, Party } from "@/components/Client";
import Flash, { SP } from "@/components/Flash";

export default async function EventPage({ params, searchParams }: SP & { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/events/${params.id}`);
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const uid = user.id;
  const e = (await q<any>(uid, `select e.*, c.name as crew_name, c.theme, crew_role(e.crew_id) as role
      from events e join crews c on c.id = e.crew_id where e.id = $1`, [params.id]))[0];
  if (!e) notFound();
  const staff = e.role === "owner" || e.role === "staff";
  const started = new Date(e.starts_at).getTime() <= Date.now();
  const next = `/events/${e.id}`;

  const counts = (await q<any>(uid, `select
      count(*) filter (where status = 'attending')::int as att,
      count(*) filter (where status = 'waitlist')::int as wait,
      count(*) filter (where status = 'attending' and checked_in)::int as present
      from registrations where event_id = $1`, [e.id]))[0];
  const mine = (await q<any>(uid, `select g.status, g.checked_in,
      (select count(*)::int + 1 from registrations w where w.event_id = g.event_id and w.status = 'waitlist' and w.seq < g.seq) as pos
      from registrations g where g.event_id = $1 and g.user_id = app_uid()`, [e.id]))[0];
  const list = await q<any>(uid, `select u.id, u.name, g.status, g.checked_in, g.seq from registrations g
      join users u on u.id = g.user_id where g.event_id = $1 and g.status <> 'cancelled'
      order by (g.status = 'attending') desc, g.seq limit 200`, [e.id]);
  const reacts = await q<any>(uid, `select emoji, count(*)::int as n, bool_or(user_id = app_uid()) as mine
      from reactions where event_id = $1 group by emoji`, [e.id]);
  const reviews = await q<any>(uid, `select u.name, r.body, r.user_id from reviews r join users u on u.id = r.user_id
      where r.event_id = $1 order by r.created_at desc limit 50`, [e.id]);
  const myReview = reviews.find((r) => r.user_id === uid);
  const rmap = new Map(reacts.map((r) => [r.emoji, r]));
  const att = list.filter((l) => l.status === "attending");
  const wait = list.filter((l) => l.status === "waitlist");
  const full = counts.att >= e.capacity;

  return (
    <div data-t={e.theme}>
      {searchParams.party === "1" && <Party />}
      <Link href={`/crews/${e.crew_id}`} className="mute">← {e.crew_name}</Link>
      <h1>{e.title}</h1>
      <Flash sp={searchParams} />
      <div className="card">
        <div>📅 {fmtKST(e.starts_at)} (KST)</div>
        <div>📍 {e.location || "장소 미정"}</div>
        {e.description && <p>{e.description}</p>}
        <div className="row sp" style={{ marginTop: 8 }}>
          <span>참석 <b>{counts.att}/{e.capacity}</b> · 대기 <b>{counts.wait}</b></span>
          <span>{started ? <span className="pill">종료·진행됨</span> : <>⏳ <Countdown to={e.starts_at} /></>}</span>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          {mine && mine.status !== "cancelled" ? (
            <>
              <span className={`pill ${mine.status === "attending" ? "ok" : "warn"}`}>
                {mine.status === "attending" ? (mine.checked_in ? "출석 완료 ✓" : "참석 확정") : `대기 ${mine.pos}번`}
              </span>
              {!started && (
                <form action="/api/act/cancel" method="post">
                  <input type="hidden" name="event" value={e.id} /><input type="hidden" name="next" value={next} />
                  <button className="btn d">{mine.status === "waitlist" ? "대기 취소" : "신청 취소"}</button>
                </form>
              )}
            </>
          ) : started ? (
            <span className="mute">이미 시작되어 신청할 수 없어요.</span>
          ) : (
            <form action="/api/act/register" method="post">
              <input type="hidden" name="event" value={e.id} /><input type="hidden" name="next" value={next} />
              <button className="btn p">{full ? "대기 신청" : "참석 신청"}</button>
            </form>
          )}
          <a className="btn" href={`/api/events/${e.id}/ics`}>📅 캘린더에 추가(ICS)</a>
        </div>
      </div>

      <h2 style={{ margin: "24px 0 8px" }}>반응</h2>
      <div className="row">
        {EMOJIS.map((em) => {
          const r = rmap.get(em);
          return (
            <form key={em} action="/api/act/react" method="post">
              <input type="hidden" name="event" value={e.id} /><input type="hidden" name="emoji" value={em} /><input type="hidden" name="next" value={next} />
              <button className={`btn react ${r?.mine ? "on" : ""}`} aria-pressed={!!r?.mine}>{em} {r?.n ?? 0}</button>
            </form>
          );
        })}
      </div>

      <h2 style={{ margin: "24px 0 8px" }}>참석자 {att.length}명 {wait.length > 0 && `· 대기 ${wait.length}명`}</h2>
      {list.length === 0 ? <div className="card empty">아직 신청자가 없어요. 첫 번째로 신청해보세요!</div> : (
        <div className="card">
          <table>
            <tbody>
              {list.map((l, i) => (
                <tr key={l.id}>
                  <td>{l.status === "attending" ? "참석" : `대기 ${wait.indexOf(l) + 1}`}</td>
                  <td>{l.name}</td>
                  <td>{l.checked_in ? "✓ 출석" : ""}</td>
                  {staff && (
                    <td>
                      {l.status === "attending" && (
                        <form action="/api/act/checkin" method="post">
                          <input type="hidden" name="event" value={e.id} /><input type="hidden" name="user" value={l.id} />
                          <input type="hidden" name="flag" value={l.checked_in ? "0" : "1"} /><input type="hidden" name="next" value={next} />
                          <button className="btn sm">{l.checked_in ? "출석 취소" : "출석 체크"}</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {staff && started && (
            <p className="mute">출석률: {counts.att ? Math.round((counts.present / counts.att) * 100) : 0}% ({counts.present}/{counts.att})</p>
          )}
        </div>
      )}

      {started && (
        <>
          <h2 style={{ margin: "24px 0 8px" }}>한 줄 소감</h2>
          {mine?.checked_in && (
            <form action="/api/act/review" method="post" className="card" style={{ marginBottom: 12 }}>
              <input type="hidden" name="event" value={e.id} /><input type="hidden" name="next" value={next} />
              <label htmlFor="body">오늘 모임 어땠나요? (100자)</label>
              <input id="body" name="body" maxLength={100} defaultValue={myReview?.body ?? ""} required />
              <div style={{ marginTop: 10 }}><button className="btn p">{myReview ? "수정" : "남기기"}</button></div>
            </form>
          )}
          {reviews.length === 0 ? <div className="card empty">아직 소감이 없어요.</div> : (
            <div className="card">{reviews.map((r, i) => <div key={i} style={{ padding: "6px 0" }}><b>{r.name}</b> <span className="mute">—</span> {r.body}</div>)}</div>
          )}
        </>
      )}

      {staff && !started && (
        <details className="card" style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>모임 수정</summary>
          <form action="/api/act/event_update" method="post">
            <input type="hidden" name="event" value={e.id} /><input type="hidden" name="next" value={next} />
            <label htmlFor="t">제목</label><input id="t" name="title" defaultValue={e.title} minLength={2} maxLength={60} required />
            <label htmlFor="l">장소</label><input id="l" name="location" defaultValue={e.location} maxLength={100} />
            <label htmlFor="a">일시 (KST)</label><input id="a" name="starts_at" type="datetime-local" defaultValue={toKstInput(e.starts_at)} required />
            <label htmlFor="c">정원</label><input id="c" name="capacity" type="number" inputMode="numeric" min={1} max={500} defaultValue={e.capacity} required />
            <label htmlFor="d">소개</label><textarea id="d" name="description" defaultValue={e.description} maxLength={1000} />
            <div style={{ marginTop: 12 }}><button className="btn p">저장</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
