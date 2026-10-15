import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/db";
import Flash, { SP } from "@/components/Flash";

export default async function Home({ searchParams }: SP) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return (
    <div>
      <Flash sp={searchParams} />
      <h1>출근 상태 한 번, 연차 신청 한 번 🗓️</h1>
      <p className="mute">팀 출석부와 연차(반차 포함) 신청·승인을 한 곳에서 관리해요.</p>
      <div className="demo">연차 산정은 월~금 근무일 기준이며 공휴일은 반영하지 않습니다. 실제 법정 연차와 다를 수 있습니다.</div>
      <div className="grid" style={{ margin: "20px 0" }}>
        <div className="card"><h2>✅ 오늘 상태 체크</h2><p className="mute">출근·재택·외근 중 하나를 누르면 팀 현황판에 바로 반영돼요.</p></div>
        <div className="card"><h2>🌴 연차·반차 신청</h2><p className="mute">관리자가 승인하면 팀 캘린더에 표시돼요.</p></div>
        <div className="card"><h2>📊 팀별 지급일수</h2><p className="mute">관리자가 팀 기본 지급일수와 팀원별 지급일수를 직접 입력해요. 월별 CSV도 내보낼 수 있어요.</p></div>
      </div>
      <div className="row">
        <Link className="btn p" href="/signup">이름만 입력하고 시작하기</Link>
      </div>
    </div>
  );
}
