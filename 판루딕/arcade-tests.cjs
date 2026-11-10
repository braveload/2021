const assert=require('node:assert/strict'),C=require('./dist/arcade-core.js'),S=require('./dist/arcade-store.js');
let shuffles=0,popCompleted=0,bubbleWins=0;
for(let seed=1;seed<=100;seed++){
 let s=C.create('shisen',seed);assert(C.valid(s));for(let p=0;p<24;p++){const pair=C.pair(s.data.board);assert(pair);assert(pair.route.length>1);const n=C.apply(s,{type:'match',a:pair.a,b:pair.b}).state;assert(C.valid(n));s=n;}assert.equal(s.status,'won');assert.equal(s.score,2400);shuffles+=s.data.reshuffles;
 let p=C.create('pop',seed);while(p.status==='playing'){const i=p.data.board.findIndex((v,i)=>C.popGroup(p.data.board,i).length>=2);assert(i>=0);p=C.apply(p,{type:'remove',index:i}).state;assert(C.valid(p));}assert(p.status==='completed'||p.status==='won');popCompleted++;
 let b=C.create('bubble',seed);while(b.status==='playing'){
  let best=null;for(let x=20;x<=460;x+=22){const t=C.apply(b,{type:'shoot',x,y:40}).state;if(!best||t.score>best.score||(t.score===best.score&&t.data.board.filter(x=>x!==null).length<best.data.board.filter(x=>x!==null).length))best=t;}
  assert(C.valid(best));b=best;
 }if(b.status==='won')bubbleWins++;
}
let p=Array(48).fill(null);p[0]=p[7]=1;assert(C.path(p,0,7));p=Array(48).fill(2);p[0]=p[7]=1;assert(C.path(p,0,7),'outside border route');p=Array(48).fill(2);p[9]=p[38]=1;assert.equal(C.path(p,9,38),null,'blocked >2 bends');assert.equal(C.path(p,9,9),null);
let q=C.create('shisen',1);q=C.apply(q,{type:'hint'}).state;assert.equal(q.score,0);const pair=C.pair(q.data.board);q=C.apply(q,{type:'match',a:pair.a,b:pair.b}).state;assert.equal(q.score,80);
let all=C.create('pop',1);all.data.board.fill(0);all=C.apply(all,{type:'remove',index:0}).state;assert.equal(all.score,64*63*5+500);assert.equal(all.status,'won');
const g=C.gravity([0,null,null,null,null,null,null,null,...Array(56).fill(null)]);assert.equal(g[56],0);assert.equal(g.filter(n=>n!==null).length,1);
let b=C.create('bubble',1);b.data.board.fill(null);b.data.board[0]=b.data.board[1]=0;b.data.current=0;b=C.apply(b,{type:'shoot',x:140,y:0}).state;assert.equal(b.status,'won');assert.equal(b.score,30);
b=C.create('bubble',1);b.data.shots=39;b=C.apply(b,{type:'shoot',x:240,y:40}).state;assert(b.status!=='playing');assert.equal(b.data.shots,40);
let brickWins=0;
for(let seed=1;seed<=5;seed++){
 let a=C.create('brick',seed);for(let t=0;t<150000&&a.status==='playing';t++){
  a=C.apply(a,{type:'move',x:Math.max(50,Math.min(430,a.data.ball.x+Math.sin(t*.013)*32))}).state;
  if(a.data.serving)a=C.apply(a,{type:'launch'}).state;
  a=C.apply(a,{type:'step',dt:.016}).state;if(t%1000===0)assert(C.valid(a));
 }assert(C.valid(a));assert.equal(a.status,'won','tracking bot must finish all three stages');assert.equal(a.score,870);brickWins++;
}
let miss=C.create('brick',1);miss.data.ball={x:400,y:566,vx:0,vy:220};miss.data.serving=false;miss.data.lives=1;miss=C.apply(miss,{type:'step',dt:.016}).state;assert.equal(miss.status,'lost');assert(C.valid(miss));

let randomSeed=123,random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;},automaticReshuffles=0;
for(let n=0;n<100;n++){let s=C.create('shisen',n+1);for(let i=47;i>0;i--){const j=Math.floor(random()*(i+1));[s.data.board[i],s.data.board[j]]=[s.data.board[j],s.data.board[i]];}if(!C.pair(s.data.board))continue;while(s.status==='playing'){const pairs=[];for(let a=0;a<48;a++)for(let b=a+1;b<48;b++)if(s.data.board[a]!==null&&s.data.board[a]===s.data.board[b]&&C.path(s.data.board,a,b))pairs.push({type:'match',a,b});assert(pairs.length,'Automatic repair must leave a legal pair');s=C.apply(s,pairs[Math.floor(random()*pairs.length)]).state;assert(C.valid(s));}automaticReshuffles+=s.data.reshuffles;}
assert(automaticReshuffles>0,'Must exercise automatic blocked-board repair');
let floating=C.create('bubble',1);floating.data.board.fill(null);floating.data.board[0]=floating.data.board[1]=0;floating.data.board[8]=1;floating.data.current=0;floating=C.apply(floating,{type:'shoot',x:140,y:0}).state;assert.equal(floating.status,'won');assert.equal(floating.score,50,'three linked bubbles plus one falling bubble');

const data=new Map([['panludiq.records.v1','original']]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const store=S.create(storage);assert(store.save(all).ok);assert(store.save(all).ok);assert.equal(store.records().rows.length,1);assert.equal(data.get('panludiq.records.v1'),'original');assert.deepEqual(store.load('pop').state,all);
data.set(store.sessionKey('shisen'),'{bad');assert(store.save(q).ok);assert.equal(data.get(store.sessionKey('shisen')+'.backup'),'{bad');
assert(!S.create({getItem:()=>null,setItem:()=>{throw Error('quota');}}).save(all).ok);
console.log(JSON.stringify({passed:true,shisenGames:100,shuffles,automaticReshuffles,popGames:popCompleted,bubbleScriptedGames:100,bubbleScriptedWins:bubbleWins,brickThreeStageWins:brickWins,pathBoundary:true,shotLimit:true,separateStorage:true,deduplicated:true}));
