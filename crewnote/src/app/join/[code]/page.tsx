import Link from "next/link";
import { getUser, q } from "@/lib/db";
import { THEMES } from "@/lib/format";
import Flash, { SP } from "@/components/Flash";

export default async function Join({ params, searchParams }: SP & { params: { code: string } }) {
  const user = await getUser();
  const code = params.code.replace(/[^0-9a-f]/g, "").slice(0, 32);
  const c = (await q<any>(null, "select * from crew_preview($1)", [code]))[0];
  if (!c) {
    return <div className="card empty"><h2>유효하지 않은 초대 링크예요</h2><p>운영자에게 새 링크를 요청해주세요.</p></div>;
  }
  const full = c.plan === "free" && c.member_count >= 30;
  return (
    <div style={{ maxWidth: 520 }} data-t={c.theme}>
      <Flash sp={searchParams} />
      <div className="card">
        <div style={{ fontSize: "2rem" }}>{THEMES[c.theme]?.emoji}</div>
        <h1>{c.name}</h1>
        <p>{c.intro || <span className="mute">소개가 아직 없어요.</span>}</p>
        <p className="mute">{THEMES[c.theme]?.label} 크루 · 멤버 {c.member_count}명</p>
        {full ? (
          <div className="flash err">멤버 정원이 가득 찼어요.</div>
        ) : user ? (
          <form action="/api/act/crew_join" method="post">
            <input type="hidden" name="code" value={code} /><input type="hidden" name="next" value={`/join/${code}`} />
            <button className="btn p full-m">이 크루에 가입하기</button>
          </form>
        ) : (
          <div className="row">
            <Link className="btn p" href={`/signup?next=/join/${code}`}>가입하고 참여</Link>
            <Link className="btn" href={`/login?next=/join/${code}`}>로그인</Link>
          </div>
        )}
      </div>
    </div>
  );
}
