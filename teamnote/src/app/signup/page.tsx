import Flash, { SP } from "@/components/Flash";
import { getUser } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Start({ searchParams }: SP) {
  const next = typeof searchParams.next === "string" && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
    ? searchParams.next : "/dashboard";
  const user = await getUser();
  if (user && !searchParams.err) redirect(next);
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
      <p className="mute">기존 로그인은 이 브라우저에서 유지됩니다. 같은 이름을 다시 입력해도 새 계정을 만들지 않습니다. 다른 기기나 브라우저에서는 기존 계정 복구 링크가 필요합니다.</p>
    </div>
  );
}
