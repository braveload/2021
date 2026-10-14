import Flash, { SP } from "@/components/Flash";

export default function Start({ searchParams }: SP) {
  const next = typeof searchParams.next === "string" && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
    ? searchParams.next : "/dashboard";
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>이름을 입력하고 시작하세요</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/start" method="post" className="card">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="name">이름(닉네임)</label>
        <input id="name" name="name" maxLength={30} autoComplete="nickname" required autoFocus />
        <div style={{ marginTop: 16 }}><button className="btn p full-m">시작하기</button></div>
      </form>
      <p className="mute">비밀번호 없이 이름만으로 시작해요. 기록은 <b>이 브라우저</b>에 연결되어 있어, 쿠키를 지우거나 다른 기기에서 열면 새 사용자로 시작돼요.</p>
    </div>
  );
}
