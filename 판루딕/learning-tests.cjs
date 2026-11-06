const assert=require('node:assert/strict'), L=require('./dist/learning-core.js'), E=require('./dist/engine.js'), C=require('./dist/solo-core.js');
let combinations=0, previews=0;
for(const p of L.lessons){const solutions=[];for(const ids of E.combinations(Array.from({length:9},(_,i)=>i))){const out=L.feedback(p.cards,ids,p.target).every(r=>r.ok);assert.equal(out,E.matches(p.cards,ids,p.target));if(out)solutions.push(ids);combinations++;}assert.deepEqual(solutions,[p.answer]);}
assert.equal(L.feedback(L.lessons[0].cards,[0,0,1],L.lessons[0].target),null);
assert.equal(L.previewDice(Array(9).fill(null),2,null,C.diceScore),null);
assert.equal(L.previewDice(Array(9).fill(null),7,0,C.diceScore),null);
const board=[1,4,null,2,3,2,1,1,4];
const edge=L.previewDice(board,5,2,C.diceScore);
assert(edge.gains.some(g=>g.key==='rows'&&g.points===10));
assert(edge.gains.some(g=>g.key==='diagonals'&&g.points===6));
assert(edge.gains.some(g=>g.key==='columns'&&g.points===8));
assert.equal(edge.delta,29);
assert.equal(edge.delta,edge.base+edge.bonus);
for(let seed=1;seed<=200;seed++){
 let s=C.create('dice',{seed,now:0,id:'preview-'+seed});
 for(let turn=0;turn<9;turn++){
  s=C.apply(s,{type:'select',index:turn%2},turn*2+1).state;
  const snapshot=JSON.stringify(s);
  for(let index=0;index<9;index++)if(s.data.board[index]===null){
   const p=L.previewDice(s.data.board,s.data.pair[s.data.selected],index,C.diceScore);
   const actual=C.apply(s,{type:'place',index},turn*2+2).state;
   assert.equal(p.total,C.result(actual).score);assert.equal(p.delta,p.base+p.bonus);assert.equal(JSON.stringify(s),snapshot,'preview must not mutate board, selection, RNG, clock or revision');previews++;
  }
  s=C.apply(s,{type:'place',index:turn},turn*2+2).state;
 }
 assert.equal(s.status,'completed');assert(C.valid(s));
}
console.log(JSON.stringify({passed:true,practiceLessons:L.lessons.length,practiceCombinations:combinations,dicePreviews:previews,completedGames:200,mutations:0}));
