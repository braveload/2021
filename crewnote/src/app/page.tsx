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
      <h1>오픈채팅은 그대로, 귀찮은 관리만 크루노트가 📒</h1>
      <p className="mute">러닝·독서·스터디 크루의 정원·대기·출석을 자동으로 처리해요.</p>
      <div className="demo">학습용 데모 · 실제 결제 없음 · 예시 데이터가 아닌 실제 입력 기록으로 통계와 배지를 계산합니다.</div>
      <div className="grid" style={{ margin: "20px 0" }}>
        <div className="card"><h2>⏱ 정원·대기 자동 처리</h2><p className="mute">동시에 신청해도 정원은 DB가 정확히 지키고, 취소가 나오면 대기 1번이 자동 승급해요.</p></div>
        <div className="card"><h2>✅ 출석·통계·CSV</h2><p className="mute">운영진이 출석을 체크하면 배지와 참여 기록이 쌓이고, CSV로 내보낼 수 있어요.</p></div>
        <div className="card"><h2>🎉 재미 요소</h2><p className="mute">남은 시간 카운트다운, 이모지 반응, 축하 애니메이션, 활동 배지, 한 줄 소감.</p></div>
      </div>
      <div className="row">
        <Link className="btn p" href="/signup">무료로 시작하기</Link>
        <Link className="btn" href="/login">로그인</Link>
      </div>
    </div>
  );
}
