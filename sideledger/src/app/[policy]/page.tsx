import { notFound } from "next/navigation";
const docs: Record<string, { title: string; paragraphs: string[] }> = {
  terms: {
    title: "이용약관 초안",
    paragraphs: [
      "현재 버전은 클라우드 체험용입니다. 운영 서비스 약관으로 확정되지 않았습니다.",
      "제공 기능: 장부 기록, 견적서·청구서, 영수증 보관, 신고 참고용 요약. 세금 계산·신고 대행은 제공하지 않습니다.",
      "운영 전 작성 필요: 사업자명·대표자·주소·연락처, 계약 성립·해지, 이용 제한, 책임 범위, 분쟁 처리.",
    ],
  },
  privacy: {
    title: "개인정보 안내 초안",
    paragraphs: [
      "가입 계정 이름·이메일·비밀번호 해시, 거래처 정보, 장부, 영수증이 기준 Supabase 인증·데이터베이스·비공개 Storage에 저장됩니다. 비밀번호 원문은 저장하지 않습니다.",
      "현재 앱은 Vercel 웹서버와 Supabase(도쿄) 인증·데이터베이스·Storage를 사용합니다. 실제 결제·청구서 메일은 미연결입니다.",
      "운영 전 작성 필요: 개인정보처리자, 처리 근거·목적·항목·보유기간, 삭제·열람·정정 절차, 위탁 및 국외 이전, 안전 조치, 문의 연락처.",
    ],
  },
  refund: {
    title: "환불정책 초안",
    paragraphs: [
      "현재 로컬 버전에는 실제 유료 결제가 연결되어 있지 않습니다. 청구서의 입금 완료는 사용자가 확인한 거래 기록이며 결제 승인이 아닙니다.",
      "운영 전 작성 필요: 연간권 가격·이용기간, 청약철회·중도해지·환불 기준, 신청 방법·처리 기한·연락처. 실제 정책은 운영자가 검토해 확정해야 합니다.",
    ],
  },
};
export default async function Policy({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params,
    d = docs[policy];
  if (!d) notFound();
  return (
    <main className="policy">
      <a href="/" className="link">
        ← 장부로 돌아가기
      </a>
      <h1>{d.title}</h1>
      <p className="fine">2026-10-17 · 검토용 초안 · 법률 자문 아님</p>
      {d.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <div className="info-strip">
        사업자 정보: 미입력 · 외부 공개 및 유료 판매 전에 확정이 필요합니다.
      </div>
    </main>
  );
}
