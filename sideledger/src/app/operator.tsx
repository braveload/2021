export const operator = {
  name: "하루한칸",
  representative: "함용길",
  registration: "860-19-02571",
  mailOrder: "제2026-서울금천-1899호",
  address: "서울특별시 금천구 시흥대로145길 60-6, 306호(가산동)",
  email: "zxc1316@naver.com",
};

export function OperatorInfo() {
  return (
    <section className="info-strip" aria-label="운영자 정보">
      <div>
        <strong>운영자: {operator.name}</strong>
        <p>
          대표자: {operator.representative} · 사업자등록번호:{" "}
          {operator.registration}
        </p>
        <p>통신판매업 신고번호: {operator.mailOrder}</p>
        <p>사업장 주소: {operator.address}</p>
        <p>
          서비스 문의·개인정보 보호 담당: {operator.representative} ·{" "}
          <a href={`mailto:${operator.email}`}>{operator.email}</a>
        </p>
      </div>
    </section>
  );
}
