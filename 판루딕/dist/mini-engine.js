(function(root){
const directions={K:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],R:[[-1,0],[1,0],[0,-1],[0,1]],B:[[-1,-1],[-1,1],[1,-1],[1,1]]};
const clone=s=>JSON.parse(JSON.stringify(s));
function key(s){return JSON.stringify([s.board,s.hands.map(h=>[...h].sort()),s.turn,s.pending])}
function create(){let board=Array(12).fill(null);let put=(i,p,t)=>board[i]={p,t};put(0,1,'R');put(1,1,'K');put(2,1,'B');put(4,1,'P');put(7,0,'P');put(9,0,'B');put(10,0,'K');put(11,0,'R');let s={board,hands:[[],[]],turn:0,ply:0,pending:null,result:null,seen:{}};s.seen[key(s)]=1;return s}
function dirs(piece){let f=piece.p===0?-1:1;if(piece.t==='P')return [[f,0]];if(piece.t==='G')return [[f,-1],[f,0],[f,1],[0,-1],[0,1],[-f,0]];return directions[piece.t]||[]}
function destinations(s,from){let pc=s.board[from];if(!pc)return [];let r=Math.floor(from/3),c=from%3;return dirs(pc).map(([dr,dc])=>[r+dr,c+dc]).filter(([a,b])=>a>=0&&a<4&&b>=0&&b<3).map(([a,b])=>a*3+b).filter(i=>!s.board[i]||s.board[i].p!==pc.p)}
function actions(s){if(s.result)return [];let out=[];s.board.forEach((pc,i)=>{if(pc?.p===s.turn)destinations(s,i).forEach(to=>out.push({from:i,to}))});if(s.hands[s.turn].length)for(let to=0;to<12;to++)if(!s.board[to])for(let t of new Set(s.hands[s.turn]))out.push({drop:t,to});return out}
function threatened(s,i){let pc=s.board[i];return !!pc&&s.board.some((other,j)=>other&&other.p!==pc.p&&destinations(s,j).includes(i))}
function apply(input,action){if(!actions(input).some(a=>a.to===action.to&&a.from===action.from&&a.drop===action.drop))throw Error('허용되지 않는 행동입니다.');let s=clone(input),p=s.turn,captured=null,moved;
if(action.drop){let h=s.hands[p];h.splice(h.indexOf(action.drop),1);s.board[action.to]={p,t:action.drop};moved=action.drop}else{moved=s.board[action.from].t;captured=s.board[action.to];s.board[action.to]=s.board[action.from];s.board[action.from]=null;if(captured&&captured.t!=='K')s.hands[p].push(captured.t==='G'?'P':captured.t);if(moved==='P'&&Math.floor(action.to/3)===(p===0?0:3))s.board[action.to].t='G'}s.ply++;
if(captured?.t==='K')s.result={winner:p,reason:'상대 킹 포획'};
else if(s.pending!==null&&s.pending!==p)s.result={winner:s.pending,reason:'킹 진입 후 상대 차례 생존'};
else{if(moved==='K'&&Math.floor(action.to/3)===(p===0?0:3))s.pending=p;s.turn=1-p;let k=key(s);s.seen[k]=(s.seen[k]||0)+1;if(s.seen[k]>=3)s.result={winner:null,reason:'동일 상태 3회 반복'};else if(s.ply>=100)s.result={winner:null,reason:'100차례 제한 도달'};else if(!actions(s).length)s.result={winner:p,reason:'상대의 가능한 행동 없음'}}
return {state:s,event:{p,...action,moved,captured:captured?.t||null,promoted:moved==='P'&&s.board[action.to]?.t==='G'}}}
const api={create,key,dirs,destinations,actions,apply,threatened};if(typeof module!=='undefined')module.exports=api;root.MiniChess=api;
})(typeof window==='undefined'?globalThis:window);
