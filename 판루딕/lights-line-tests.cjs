const assert=require('node:assert/strict'),C=require('./dist/solo-core.js'),L=require('./dist/learning-core.js');
for(const lesson of L.lightLessons){let board=lesson.presses.reduce((b,i)=>b^C.mask(i),C.TARGET);assert.notEqual(board,C.TARGET);const before=board;for(const i of lesson.presses)board^=C.mask(i);assert.equal(board,C.TARGET);let restored=before,answer=C.solution(before);for(let i=0;i<16;i++)if(answer&(1<<i))restored^=C.mask(i);assert.equal(restored,C.TARGET);}
assert.equal(Array.from({length:16},(_,i)=>!!(C.mask(0)&(1<<i))).filter(Boolean).length,3);
assert.equal(Array.from({length:16},(_,i)=>!!(C.mask(5)&(1<<i))).filter(Boolean).length,5);
function make(moves){let s=C.create('line',{seed:1,now:0,difficulty:'easy',starter:'human'});for(const [i,index]of moves.entries())s=C.apply(s,{type:'place',index},i+1).state;assert(C.valid(s));return s;}
const cross=make([1,20,5,21,7,23,11,24,6]);const crossInfo=L.lineFeedback(cross,C.lineWindows);
assert.equal(crossInfo.events.at(-1).points,6);assert.equal(crossInfo.events.at(-1).lines.length,2);
const afterAI=C.apply(cross,{type:'place',index:22},10).state;assert(L.lineFeedback(afterAI,C.lineWindows).events.some(e=>e.player===1&&e.move===9&&e.points===6));
const overlap=make([0,20,1,21,2,23,3,24,4]);const f=L.lineFeedback(overlap,C.lineWindows);assert.equal(f.events.filter(e=>e.player===1).reduce((n,e)=>n+e.points,0),9);
let states=0;
for(const starter of ['human','ai'])for(let seed=1;seed<=150;seed++){
 let s=C.create('line',{seed,now:0,difficulty:'easy',starter});
 for(let turn=0;turn<20;turn++){
  const actions=C.legalActions(s),action=actions[(seed*17+turn*11)%actions.length];s=C.apply(s,action,turn+1).state;
  const snapshot=JSON.stringify(s),info=L.lineFeedback(s,C.lineWindows),score=C.lineScore(s.data.board);
  for(const player of [1,2]){assert.equal(info.events.filter(e=>e.player===player).reduce((n,e)=>n+e.points,0),score[player-1].linePoints);assert.equal(info.lines.filter(l=>l.player===player).length,score[player-1].lines.length);assert.equal(info.center[player-1],score[player-1].center);}
  assert.equal(JSON.stringify(s),snapshot);states++;
 }
 assert(C.valid(s));assert(C.validRecord(C.record(s)));
}
console.log(JSON.stringify({passed:true,lightsLessons:L.lightLessons.length,replayedLineStates:states,crossingPoints:6,overlapPoints:9,humanScoreSurvivesAI:true,stateMutations:0}));
