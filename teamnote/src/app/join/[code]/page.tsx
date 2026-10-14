import Link from "next/link";
import { getUser, q } from "@/lib/db";
import Flash, { SP } from "@/components/Flash";

export default async function Join({ params, searchParams }: SP & { params: { code: string } }) {
  const user = await getUser();
  const code = params.code.replace(/[^0-9a-f]/g, "").slice(0, 32);
  const t = (await q<any>(null, "select * from team_preview($1)", [code]))[0];
  if (!t) return <div className="card empty"><h2>유효하지 않은 초대 링크예요</h2><p>팀장에게 새 링크를 요청해주세요.</p></div>;
  return (
    <div style={{ maxWidth: 520 }}>
      <Flash sp={searchParams} />
      <div className="card">
        <div style={{ fontSize: "2rem" }}>🗓️</div>
        <h1>{t.name}</h1>
        <p className="mute">팀원 {t.member_count}명</p>
        {user ? (
          <form action="/api/act/team_join" method="post">
            <input type="hidden" name="code" value={code} /><input type="hidden" name="next" value={`/join/${code}`} />
            <button className="btn p full-m">{user.name}(으)로 이 팀에 가입하기</button>
          </form>
        ) : (
          <form action="/api/act/start" method="post">
            <input type="hidden" name="next" value={`/join/${code}`} />
            <label htmlFor="name">이름(닉네임)</label>
            <input id="name" name="name" maxLength={30} required />
            <div style={{ marginTop: 12 }}><button className="btn p full-m">이름 입력하고 계속</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
