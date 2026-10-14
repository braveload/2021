import { redirect } from "next/navigation";
import { getUser } from "@/lib/db";
import Flash, { SP } from "@/components/Flash";

export default async function NewTeam({ searchParams }: SP) {
  if (!(await getUser())) redirect("/login");
  return (
    <div style={{ maxWidth: 520 }}>
      <h1>새 팀 만들기</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/team_create" method="post" className="card">
        <input type="hidden" name="next" value="/teams/new" />
        <label htmlFor="name">팀 이름</label>
        <input id="name" name="name" minLength={2} maxLength={40} required />
        <label htmlFor="days">연간 연차 지급일수 (팀 기본값, 0.5 단위)</label>
        <input id="days" name="annual_days" type="number" inputMode="decimal" step="0.5" min="0" max="60" defaultValue={15} required />
        <p className="mute">팀원별로 다르게 지급하려면 팀 페이지에서 개별 지정할 수 있어요.</p>
        <div style={{ marginTop: 16 }}><button className="btn p full-m">팀 만들기</button></div>
      </form>
    </div>
  );
}
