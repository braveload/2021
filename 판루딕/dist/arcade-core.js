/* Original shape-based arcade rules. Pure, deterministic game state. */
(function(root){
'use strict';
const GAMES={brick:{name:'벽돌깨기',route:'brick-breaker.html',tag:'반사 액션 · 3단계'},shisen:{name:'사천성',route:'shisen.html',tag:'연결 퍼즐 · 24쌍'},pop:{name:'블록 팝',route:'block-pop.html',tag:'블록 제거 · 점수 도전'},bubble:{name:'버블 슈터',route:'bubble-shooter.html',tag:'조준 퍼즐 · 40발'}};
const clone=s=>JSON.parse(JSON.stringify(s)),int=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b,finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
function rand(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function shuffle(s,a){a=a.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(rand(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function brickLayout(stage){return Array((stage+2)*6).fill(1);}
function serve(d){d.ball={x:d.paddle,y:493,vx:95,vy:-Math.sqrt((220+(d.stage-1)*40)**2-95**2)};d.serving=true;}
function create(game,seed=Date.now(),now=Date.now()){
 if(!GAMES[game])throw Error('지원하지 않는 게임');
 const s={schema:1,version:'1.0.0',game,id:`${game}-${seed>>>0}-${now}`,seed:(seed>>>0)||1,rng:(seed>>>0)||1,status:'playing',score:0,revision:0,startedAt:now,updatedAt:now,finishedAt:null};
 if(game==='brick'){s.data={stage:1,lives:3,paddle:240,bricks:brickLayout(1),serving:true};serve(s.data);}
 if(game==='shisen'){const pairs=shuffle(s,Array.from({length:24},(_,i)=>i%8));let board=pairs.flatMap(n=>[n,n]);for(let attempt=0;attempt<100;attempt++){const candidate=shuffle(s,board),test=candidate.slice();let p;while((p=pair(test))){test[p.a]=test[p.b]=null;}if(test.every(n=>n===null)){board=candidate;break;}}s.data={board,hints:0,reshuffles:0,hint:[]};}
 if(game==='pop'){let board=Array.from({length:64},()=>Math.floor(rand(s)*5));board[0]=board[1];s.data={board,removed:0,groups:0};}
 if(game==='bubble'){const board=Array(88).fill(null);for(let i=0;i<32;i++)board[i]=Math.floor(rand(s)*3);s.data={board,shots:0,current:0,next:0};s.data.current=nextColor(s);s.data.next=nextColor(s);}
 return s;
}
function path(board,a,b){
 if(a===b||!int(a,0,47)||!int(b,0,47)||board[a]===null||board[b]===null)return null;
 const [sx,sy]=[a%8+1,Math.floor(a/8)+1],[tx,ty]=[b%8+1,Math.floor(b/8)+1];
 const dirs=[[1,0],[0,1],[-1,0],[0,-1]],q=[[sx,sy,-1,0,[[sx,sy]]]],seen=new Map();
 for(let head=0;head<q.length;head++){
  const [x,y,dir,turns,route]=q[head];
  for(let k=0;k<4;k++){const turns2=turns+(dir>=0&&dir!==k?1:0);if(turns2>2)continue;const nx=x+dirs[k][0],ny=y+dirs[k][1];if(nx<0||nx>9||ny<0||ny>7)continue;
   if(nx===tx&&ny===ty)return [...route,[nx,ny]];
   if(nx>0&&nx<9&&ny>0&&ny<7&&board[(ny-1)*8+nx-1]!==null)continue;
   const key=`${nx},${ny},${k}`;if((seen.get(key)??3)<=turns2)continue;seen.set(key,turns2);q.push([nx,ny,k,turns2,[...route,[nx,ny]]]);
  }
 }
 return null;
}
function pair(board,any=false){for(let a=0;a<48;a++)if(board[a]!==null)for(let b=a+1;b<48;b++)if(board[b]!==null&&(any||board[a]===board[b])){const route=path(board,a,b);if(route)return {a,b,route};}return null;}
function unblock(d){if(!d.board.some(n=>n!==null)||pair(d.board))return false;const p=pair(d.board,true);if(!p)return false;const c=d.board.findIndex((n,i)=>i!==p.a&&n===d.board[p.a]);[d.board[p.b],d.board[c]]=[d.board[c],d.board[p.b]];d.reshuffles++;return true;}
function popGroup(board,index){if(!int(index,0,63)||board[index]===null)return [];const q=[index],seen=new Set(q);for(let h=0;h<q.length;h++){const i=q[h],r=Math.floor(i/8),c=i%8;for(const j of [r?i-8:-1,r<7?i+8:-1,c?i-1:-1,c<7?i+1:-1])if(j>=0&&!seen.has(j)&&board[j]===board[index]){seen.add(j);q.push(j);}}return q;}
function hasPop(board){return board.some((n,i)=>n!==null&&((i%8<7&&n===board[i+1])||(i<56&&n===board[i+8])));}
function gravity(board){const columns=[];for(let c=0;c<8;c++){const a=Array.from({length:8},(_,r)=>board[r*8+c]).filter(n=>n!==null);if(a.length)columns.push([...Array(8-a.length).fill(null),...a]);}return Array.from({length:64},(_,i)=>columns[i%8]?.[Math.floor(i/8)]??null);}
function neighbors(i){let r=Math.floor(i/8),c=i%8,ds=r%2?[[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]]:[[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];return ds.flatMap(([dr,dc])=>int(r+dr,0,10)&&int(c+dc,0,7)?[(r+dr)*8+c+dc]:[]);}
function bubblePos(i){let r=Math.floor(i/8);return {x:40+(i%8)*50+(r%2)*25,y:35+r*43};}
function flood(board,start,same=true){const q=start.slice(),seen=new Set(q);for(let h=0;h<q.length;h++)for(const j of neighbors(q[h]))if(board[j]!==null&&!seen.has(j)&&(!same||board[j]===board[q[h]])){seen.add(j);q.push(j);}return q;}
function nextColor(s){const colors=[...new Set(s.data.board.filter(n=>n!==null))];return colors.length?colors[Math.floor(rand(s)*colors.length)]:0;}
function traceBubble(board,target){
 let dx=target.x-240,dy=Math.min(-40,target.y-510),length=Math.hypot(dx,dy);dx=dx/length*3;dy=dy/length*3;let x=240,y=510;const route=[[x,y]];
 for(let step=0;step<1200;step++){
  x+=dx;y+=dy;if(x<20){x=40-x;dx=Math.abs(dx);}if(x>460){x=920-x;dx=-Math.abs(dx);}if(step%8===0)route.push([x,y]);
  const hit=board.findIndex((n,i)=>n!==null&&Math.hypot(bubblePos(i).x-x,bubblePos(i).y-y)<=40);
  if(y<=35||hit>=0){const candidates=hit>=0?neighbors(hit).filter(i=>board[i]===null):Array.from({length:8},(_,i)=>i).filter(i=>board[i]===null);
   if(!candidates.length)return {index:null,route};candidates.sort((a,b)=>Math.hypot(bubblePos(a).x-x,bubblePos(a).y-y)-Math.hypot(bubblePos(b).x-x,bubblePos(b).y-y));return {index:candidates[0],route:[...route,[x,y]]};
  }
 }
 return {index:null,route};
}
function finish(s,status,now){s.status=status;s.finishedAt=now;}
function brickStep(s,dt){
 const d=s.data,b=d.ball;if(d.serving){b.x=d.paddle;return;}
 const ticks=Math.max(1,Math.ceil(dt/.006)),step=dt/ticks;
 for(let t=0;t<ticks&&s.status==='playing'&&!d.serving;t++){
  const px=b.x,py=b.y;b.x+=b.vx*step;b.y+=b.vy*step;
  if(b.x<7){b.x=14-b.x;b.vx=Math.abs(b.vx);}if(b.x>473){b.x=946-b.x;b.vx=-Math.abs(b.vx);}if(b.y<7){b.y=14-b.y;b.vy=Math.abs(b.vy);}
  if(b.vy>0&&py<=505&&b.y>=505&&Math.abs(b.x-d.paddle)<=57){b.y=504;const speed=220+(d.stage-1)*40,offset=Math.max(-1,Math.min(1,(b.x-d.paddle)/50));b.vx=offset*speed*.8;if(Math.abs(b.vx)<40)b.vx=40*(b.vx<0?-1:1);b.vy=-Math.sqrt(speed*speed-b.vx*b.vx);}
  for(let i=0;i<d.bricks.length;i++)if(d.bricks[i]){const x=24+(i%6)*73,y=55+Math.floor(i/6)*29;if(b.x>=x-7&&b.x<=x+66+7&&b.y>=y-7&&b.y<=y+22+7){d.bricks[i]=0;s.score+=10;if(px<x-7||px>x+73){b.vx=-b.vx;b.x=px;}else{b.vy=-b.vy;b.y=py;}break;}}
  if(!d.bricks.some(Boolean)){s.score+=50;if(d.stage===3)finish(s,'won',s.updatedAt);else{d.stage++;d.bricks=brickLayout(d.stage);serve(d);}break;}
  if(b.y>567){d.lives--;if(!d.lives)finish(s,'lost',s.updatedAt);else serve(d);break;}
 }
}
function apply(state,a,now=Date.now()){
 const reject=error=>({state,error});if(state.status!=='playing')return reject('종료된 경기입니다. 새 도전을 시작하세요.');if(!a)return reject('조작을 선택해주세요.');
 const s=clone(state),d=s.data;s.updatedAt=Math.max(state.updatedAt,now);s.revision++;
 if(s.game==='brick'){
  if(a.type==='move'&&finite(a.x,0,480)){d.paddle=Math.max(50,Math.min(430,a.x));if(d.serving)d.ball.x=d.paddle;}
  else if(a.type==='launch'&&d.serving)d.serving=false;
  else if(a.type==='step'&&finite(a.dt,.001,.05))brickStep(s,a.dt);else return reject('패들을 움직이거나 발사하세요.');
 }else if(s.game==='shisen'){
  if(a.type==='hint'){const p=pair(d.board);if(!p)return reject('연결 가능한 짝이 없습니다.');d.hint=[p.a,p.b];d.hints++;}
  else if(a.type==='match'&&int(a.a,0,47)&&int(a.b,0,47)&&a.a!==a.b&&d.board[a.a]!==null&&d.board[a.a]===d.board[a.b]&&path(d.board,a.a,a.b)){d.board[a.a]=d.board[a.b]=null;d.hint=[];unblock(d);}
  else return reject('같은 문양 두 개를 꺾임 2번 이내로 연결하세요.');
  s.score=Math.max(0,d.board.filter(n=>n===null).length/2*100-d.hints*20);if(d.board.every(n=>n===null))finish(s,'won',s.updatedAt);
 }else if(s.game==='pop'){
  if(a.type!=='remove')return reject('같은 색 블록을 선택하세요.');const group=popGroup(d.board,a.index);if(group.length<2)return reject('상하좌우로 이어진 같은 색 2개 이상을 골라주세요.');
  group.forEach(i=>{d.board[i]=null;});d.board=gravity(d.board);d.removed+=group.length;d.groups++;s.score+=group.length*(group.length-1)*5;
  if(!hasPop(d.board)){if(d.removed===64){s.score+=500;finish(s,'won',s.updatedAt);}else finish(s,'completed',s.updatedAt);}
 }else{
  if(a.type!=='shoot'||!finite(a.x,0,480)||!finite(a.y,0,470))return reject('위쪽을 조준해주세요.');const result=traceBubble(d.board,a);d.shots++;
  if(result.index===null)finish(s,'lost',s.updatedAt);
  else{d.board[result.index]=d.current;const cluster=flood(d.board,[result.index]);if(cluster.length>=3){cluster.forEach(i=>{d.board[i]=null;});s.score+=cluster.length*10;const anchored=new Set(flood(d.board,Array.from({length:8},(_,i)=>i).filter(i=>d.board[i]!==null),false));for(let i=0;i<88;i++)if(d.board[i]!==null&&!anchored.has(i)){d.board[i]=null;s.score+=20;}}
   if(d.board.every(n=>n===null))finish(s,'won',s.updatedAt);else if(d.shots>=40||d.board.some((n,i)=>n!==null&&Math.floor(i/8)===10))finish(s,'lost',s.updatedAt);
   else{d.current=d.next;if(!d.board.includes(d.current))d.current=nextColor(s);d.next=nextColor(s);}
  }
 }
 return {state:s,error:''};
}
function valid(s){
 if(!s||s.schema!==1||s.version!=='1.0.0'||!GAMES[s.game]||typeof s.id!=='string'||!s.id||s.id.length>160||!int(s.rng,1,4294967295)||!int(s.seed,1,4294967295)||!int(s.score,0,1000000)||!int(s.revision,0,100000000)||!Number.isFinite(s.startedAt)||!Number.isFinite(s.updatedAt)||s.updatedAt<s.startedAt||!['playing','won','lost','completed'].includes(s.status)||(s.status==='playing'?s.finishedAt!==null:s.finishedAt!==s.updatedAt))return false;
 const d=s.data;if(!d)return false;const board=(length,max)=>Array.isArray(d.board)&&d.board.length===length&&d.board.every(n=>n===null||int(n,0,max));
 if(s.game==='brick')return int(d.stage,1,3)&&int(d.lives,0,3)&&finite(d.paddle,50,430)&&Array.isArray(d.bricks)&&d.bricks.length===(d.stage+2)*6&&d.bricks.every(n=>n===0||n===1)&&typeof d.serving==='boolean'&&d.ball&&finite(d.ball.x,-10,490)&&finite(d.ball.y,-10,580)&&finite(d.ball.vx,-400,400)&&finite(d.ball.vy,-400,400)&&(s.status!=='lost'||d.lives===0)&&(s.status!=='won'||d.stage===3&&!d.bricks.some(Boolean));
 if(s.game==='shisen')return board(48,7)&&int(d.hints,0,100000)&&int(d.reshuffles,0,24)&&Array.isArray(d.hint)&&[0,2].includes(d.hint.length)&&d.hint.every(i=>int(i,0,47))&&Array.from({length:8},(_,n)=>d.board.filter(v=>v===n).length).every(n=>n%2===0)&&s.score===Math.max(0,d.board.filter(n=>n===null).length/2*100-d.hints*20)&&(s.status==='won')===d.board.every(n=>n===null);
 if(s.game==='pop')return board(64,4)&&int(d.removed,0,64)&&int(d.groups,0,32)&&d.board.filter(n=>n===null).length===d.removed&&(s.status==='playing'?hasPop(d.board):!hasPop(d.board))&&(s.status!=='won'||d.removed===64);
 return board(88,2)&&int(d.shots,0,40)&&int(d.current,0,2)&&int(d.next,0,2)&&(s.status!=='won'||d.board.every(n=>n===null))&&(s.status!=='playing'||d.shots<40&&d.board.some(n=>n!==null));
}
function record(s){return valid(s)&&s.status!=='playing'?{schema:1,version:s.version,game:s.game,id:s.id,score:s.score,outcome:s.status,finishedAt:s.finishedAt}:null;}
function validRecord(r){return r&&r.schema===1&&r.version==='1.0.0'&&!!GAMES[r.game]&&typeof r.id==='string'&&r.id.length>0&&r.id.length<161&&int(r.score,0,1000000)&&['won','lost','completed'].includes(r.outcome)&&Number.isFinite(r.finishedAt);}
const api={GAMES,create,apply,valid,record,validRecord,path,pair,popGroup,gravity,hasPop,neighbors,bubblePos,traceBubble,flood,brickLayout};if(typeof module!=='undefined')module.exports=api;root.ArcadeCore=api;
})(typeof window==='undefined'?globalThis:window);
