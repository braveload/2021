import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { fmtKST } from "@/lib/format";
import Flash, { SP } from "@/components/Flash";

export default async function Notifications({ searchParams }: SP) {
  const user = await getUser();
  if (!user) redirect("/login");
  const rows = await q<any>(user.id, "select * from notifications where user_id = app_uid() order by created_at desc limit 50");
  return (
    <div>
      <div className="row sp"><h1>알림함</h1>
        <form action="/api/act/read_all" method="post"><input type="hidden" name="next" value="/notifications" /><button className="btn sm">모두 읽음</button></form>
      </div>
      <Flash sp={searchParams} />
      <p className="mute">메일 대신 서비스 안의 알림함으로 알려드려요. (대기 승급·신청 결과·24시간 전 리마인더)</p>
      {rows.length === 0 ? <div className="card empty">아직 알림이 없어요.</div> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((n) => (
            <div key={n.id} className="card" style={n.read_at ? { opacity: 0.7 } : { borderColor: "var(--brand)" }}>
              <div className="row sp">
                <span>{n.event_id ? <Link href={`/events/${n.event_id}`}>{n.body}</Link> : n.body}</span>
                {!n.read_at && <span className="pill">새 알림</span>}
              </div>
              <div className="mute">{fmtKST(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
