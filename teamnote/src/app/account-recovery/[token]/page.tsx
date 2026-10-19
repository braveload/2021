import Link from "next/link";
import { getUser,q,sha256 } from "@/lib/db";
import Flash,{SP} from "@/components/Flash";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};

export default async function Recovery({params,searchParams}:SP & {params:{token:string}}) {
  const token=params.token;
  if(!/^[0-9a-f]{64}$/.test(token)) return <div className="card">올바르지 않은 복구 링크입니다.</div>;
  const r=(await q<any>(null,"select * from account_recovery_preview($1)",[sha256(token)]))[0];
  if(!r) return <div className="card">만료되었거나 올바르지 않은 복구 링크입니다.</div>;
  const current=await getUser();
  return <div style={{maxWidth:520}}>
    <h1>기존 계정으로 연결</h1><Flash sp={searchParams}/>
    <div className="card"><h2>{r.team_name}</h2>
      <p><b>{r.name}</b>님의 기존 계정입니다. 역할: {r.role==="owner"?"관리자":"팀원"}</p>
      {r.used?<><p>이미 사용한 링크입니다. 연결한 브라우저에서 내 팀으로 들어가세요.</p><Link className="btn p" href="/dashboard">내 팀으로 가기</Link></>:<>
        <p>새 계정을 만들지 않고 기존 팀과 기록을 그대로 연결합니다.</p>
        {current&&<p className="mute">현재 {current.name}님으로 접속 중입니다. 연결하면 위의 기존 계정으로 전환합니다.</p>}
        <form action="/api/act/account_recovery" method="post">
          <input type="hidden" name="token" value={token}/><input type="hidden" name="next" value={`/account-recovery/${token}`}/>
          <button className="btn p full-m">{r.name}님 기존 계정으로 연결하기</button>
        </form><p className="mute">본인만 사용하는 일회용 링크입니다. 연결 후에는 같은 브라우저로 접속해주세요.</p>
      </>}
    </div>
  </div>;
}
