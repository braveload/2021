const assert=require('node:assert/strict'),M=require('./dist/mini-engine.js');
const piece=(p,t)=>({p,t});function blank(turn=0){return {board:Array(12).fill(null),hands:[[],[]],turn,ply:0,pending:null,result:null,seen:{}}}function step(s,a){return M.apply(s,a).state}
let s=M.create();assert.equal(s.board.filter(Boolean).length,8);assert.equal(s.board[0].t,'R');assert.equal(s.board[9].t,'B');assert(M.actions(s).some(a=>a.from===7&&a.to===4));
assert.throws(()=>step(s,{from:0,to:3}));assert.throws(()=>step(s,{from:7,to:7}));
let first=step(s,{from:7,to:4});assert.deepEqual(first.hands[0],['P']);assert.equal(s.board[7].t,'P');assert.equal(first.turn,1);
let x=blank();x.board[4]=piece(0,'P');x.board[11]=piece(0,'K');x.board[2]=piece(1,'K');x=step(x,{from:4,to:1});assert.equal(x.board[1].t,'G');assert(M.destinations(x,1).includes(4));assert(!M.destinations(x,1).includes(3));
x.turn=1;x.board[0]=piece(1,'R');x=step(x,{from:0,to:1});assert.deepEqual(x.hands[1],['P']);
x=blank();x.board[10]=piece(0,'K');x.board[1]=piece(1,'K');x.hands[0]=['P'];let d=step(x,{drop:'P',to:0});assert.equal(d.board[0].t,'P');assert.equal(M.destinations(d,0).length,0);assert.equal(d.hands[0].length,0);assert.throws(()=>step(x,{drop:'K',to:3}));assert.throws(()=>step(x,{drop:'P',to:1}));
x=blank();x.board[3]=piece(0,'K');x.board[11]=piece(1,'K');x=step(x,{from:3,to:0});assert.equal(x.pending,0);assert.equal(x.result,null);x=step(x,{from:11,to:10});assert.equal(x.result.winner,0);assert.match(x.result.reason,/생존/);
x=blank();x.board[3]=piece(0,'K');x.board[1]=piece(1,'K');x=step(x,{from:3,to:0});assert(M.threatened(x,0));x=step(x,{from:1,to:0});assert.equal(x.result.winner,1);assert.match(x.result.reason,/포획/);assert.equal(M.actions(x).length,0);
x=blank();x.board[9]=piece(0,'K');x.board[2]=piece(1,'K');x.seen[M.key(x)]=1;for(let t=0;t<2;t++)for(let a of [{from:9,to:10},{from:2,to:1},{from:10,to:9},{from:1,to:2}])x=step(x,a);assert.equal(x.result.winner,null);assert.match(x.result.reason,/3회/);
x=blank();x.board[9]=piece(0,'K');x.board[2]=piece(1,'K');x.ply=99;x=step(x,{from:9,to:10});assert.match(x.result.reason,/100/);
x=blank();x.board[3]=piece(0,'K');x.board[0]=piece(1,'K');x.ply=99;x=step(x,{from:3,to:0});assert.equal(x.result.winner,0);assert.match(x.result.reason,/포획/);
// Legal randomized complete games: invariant, finite termination and immutable inputs.
for(let n=0;n<300;n++){let g=M.create();while(!g.result){let aa=M.actions(g);assert(aa.length>0);let a=aa[Math.floor(Math.random()*aa.length)],before=JSON.stringify(g);let next=step(g,a);assert.equal(JSON.stringify(g),before);assert.equal(next.board.filter(Boolean).length+next.hands[0].length+next.hands[1].length,next.result?.reason==='상대 킹 포획'?7:8);assert(next.ply<=100);g=next}assert([null,0,1].includes(g.result.winner))}
console.log('PASS: setup, legal moves, capture, drops, promotion/demotion, king threat, survival/capture precedence, repetition, turn limit, 300 complete randomized games');
