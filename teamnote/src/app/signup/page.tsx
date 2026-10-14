import Link from "next/link";
import Flash, { SP } from "@/components/Flash";

export default function Signup({ searchParams }: SP) {
  const next = typeof searchParams.next === "string" ? searchParams.next : "/dashboard";
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>가입하기</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/signup" method="post" className="card">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="name">이름(닉네임)</label>
        <input id="name" name="name" maxLength={30} autoComplete="nickname" required />
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        <label htmlFor="pw">비밀번호 (8자 이상)</label>
        <input id="pw" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
        <div style={{ marginTop: 16 }}><button className="btn p full-m">가입하고 시작</button></div>
      </form>
      <p className="mute">이미 계정이 있나요? <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link></p>
    </div>
  );
}
