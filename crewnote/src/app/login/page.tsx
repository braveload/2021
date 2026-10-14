import Link from "next/link";
import Flash, { SP } from "@/components/Flash";

export default function Login({ searchParams }: SP) {
  const next = typeof searchParams.next === "string" ? searchParams.next : "/dashboard";
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>로그인</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/login" method="post" className="card">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        <label htmlFor="pw">비밀번호</label>
        <input id="pw" name="password" type="password" autoComplete="current-password" required />
        <div style={{ marginTop: 16 }}><button className="btn p full-m">로그인</button></div>
      </form>
      <p className="mute">처음이신가요? <Link href={`/signup?next=${encodeURIComponent(next)}`}>가입하기</Link></p>
    </div>
  );
}
