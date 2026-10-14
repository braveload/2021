import { notFound, redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { fmtKST } from "@/lib/format";
import Flash, { SP } from "@/components/Flash";

export default async function Billing({ params, searchParams }: SP & { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const crew = (await q<any>(user.id, "select id, name, plan from crews where id = $1", [params.id]))[0];
  if (!crew) notFound();
  const role = (await q<any>(user.id, "select crew_role($1) as r", [params.id]))[0].r;
  if (role !== "owner") notFound();
  const log = await q<any>(user.id, "select plan, changed_at from plan_changes where crew_id = $1 order by changed_at desc limit 10", [params.id]);
  const target = crew.plan === "pro" ? "free" : "pro";
  return (
    <div style={{ maxWidth: 560 }}>
      <h1>구독 (모의)</h1>
      <Flash sp={searchParams} />
      <div className="demo">학습용 데모 · 실제 결제 없음 — 카드 정보를 받지 않으며 청구도 발생하지 않습니다.</div>
      <div className="card">
        <div className="stat">{crew.plan === "pro" ? "Pro (모의)" : "Free"}</div>
        <p className="mute">Free: 멤버 30명·운영진 1명 / Pro(모의): 멤버 무제한·운영진 5명. 제한은 DB에서 강제됩니다.</p>
        <form action="/api/act/set_plan" method="post">
          <input type="hidden" name="crew" value={crew.id} /><input type="hidden" name="plan" value={target} />
          <input type="hidden" name="next" value={`/crews/${crew.id}/billing`} />
          <button className="btn p">{target === "pro" ? "Pro로 전환 (모의)" : "Free로 되돌리기"}</button>
        </form>
      </div>
      <h2 style={{ marginTop: 24 }}>변경 기록</h2>
      {log.length === 0 ? <div className="card empty">아직 변경 기록이 없어요.</div> : (
        <div className="card">{log.map((l, i) => <div key={i} className="row sp"><span>{l.plan}</span><span className="mute">{fmtKST(l.changed_at)}</span></div>)}</div>
      )}
    </div>
  );
}
