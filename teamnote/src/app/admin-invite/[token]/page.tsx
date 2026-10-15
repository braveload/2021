import Link from "next/link";
import { getUser, q, sha256 } from "@/lib/db";
import Flash, { SP } from "@/components/Flash";
import { InviteShare } from "@/components/Client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminInvite({ params, searchParams }: SP & { params: { token: string } }) {
  const token = params.token;
  if (!/^[0-9a-f]{64}$/.test(token)) return <div className="card">올바르지 않은 관리자 초대 링크입니다.</div>;
  const invite = (await q<any>(null, "select * from admin_invite_preview($1)", [sha256(token)]))[0];
  if (!invite) return <div className="card">만료되었거나 올바르지 않은 관리자 초대입니다.</div>;
  const user = await getUser();
  const sameAccount = user?.name === invite.intended_name;
  return <div style={{ maxWidth: 520 }}>
    <h1>관리자 초대</h1><Flash sp={searchParams} />
    <div className="card">
      <h2>{invite.team_name}</h2>
      <p><b>{invite.intended_name}</b>님 전용 관리자 초대입니다.</p>
      {invite.claimed ? <><p>이미 사용한 일회용 링크입니다. 활성화한 브라우저에서 팀으로 접속해주세요.</p><Link className="btn p" href="/dashboard">내 팀으로 가기</Link></> : <>
        <p>활성화하면 팀의 연차 신청을 승인·반려하고 팀원 설정을 관리할 수 있습니다.</p>
        {user && !sameAccount && <p className="mute">현재 {user.name}님으로 접속 중입니다. 아래 버튼을 누르면 {invite.intended_name}님의 새 계정으로 전환합니다.</p>}
        <form action={sameAccount ? "/api/act/admin_invite_claim" : "/api/act/admin_invite_start"} method="post">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={`/admin-invite/${token}`} />
          <button className="btn p full-m">{invite.intended_name}님 관리자로 시작하기</button>
        </form>
        <p className="mute">본인만 사용하세요. 이 링크는 한 번만 사용할 수 있습니다. 활성화 후에는 같은 브라우저에서 접속하고 쿠키를 유지해주세요.</p>
        <InviteShare label="카톡 초대문구 복사" text={`팀노트 출석부,연차신청\n${invite.intended_name}님 관리자 전용 초대입니다. 아래 링크에서 ‘관리자로 시작하기’를 눌러주세요.\nhttps://teamnote-demo-iota.vercel.app/admin-invite/${token}?share=20261015\n본인만 사용하는 일회용 링크입니다.`} />
      </>}
    </div>
  </div>;
}
