const assert=require('node:assert/strict'), C=require('./dist/solo-core.js'), R=require('./dist/replay-core.js'), S=require('./dist/solo-store.js');
const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const normal=S.create(storage), review=S.create(storage,{review:true});
function complete(s){if(s.game==='reverse'){let bits=C.solution(s.data.board);for(let i=0;i<16;i++)if(bits&(1<<i))s=C.apply(s,{type:'press',index:i}).state;}else for(let i=0;i<9;i++){s=C.apply(s,{type:'select',index:0}).state;s=C.apply(s,{type:'place',index:i}).state;}return s;}
for(const game of ['reverse','dice']){
 const original=C.create(game,{seed:785,mode:'challenge',difficulty:'hard',now:100});
 const done=complete(original);assert(normal.save(done).ok);const before=JSON.stringify([...data]);
 let practice=R.create(done,500);assert(R.valid(practice));assert(review.save(practice).ok);assert(!normal.save(practice).ok);
 assert.equal(normal.load(game).state.id,done.id);
 if(game==='reverse')assert.equal(practice.data.board,original.data.initialBoard);
 else {let a=original,b=practice;for(let turn=0;turn<9;turn++){assert.deepEqual(a.data.pair,b.data.pair);a=C.apply(C.apply(a,{type:'select',index:0}).state,{type:'place',index:turn}).state;b=C.apply(C.apply(b,{type:'select',index:1}).state,{type:'place',index:8-turn}).state;}assert(R.valid(b));}
 practice=complete(practice);assert(review.save(practice).ok);assert(review.save(practice).ok);assert.equal(review.records().rows.filter(r=>r.game===game).length,1);
 const nested=R.create(practice,600);assert(R.valid(nested));assert(!nested.reviewSource.reviewSource);
 assert.equal(normal.load(game).state.id,done.id);assert.equal(normal.records().rows.filter(r=>r.game===game).length,1);
 assert.equal(review.records().rows.find(r=>r.game===game).attemptType,'review');
}
assert.equal(R.tripleGoal(3,0),'다음 목표: 정답 라운드를 4개로 늘려보세요.');assert(R.tripleGoal(5,0).includes('모두'));assert(R.tripleGoal(6,1).includes('오답 없이'));assert(R.tripleGoal(6,0).includes('최고점'));
const bad=JSON.parse(JSON.stringify(review.load('dice').state));bad.reviewSource.seed++;assert(!R.valid(bad));
const failed=S.create({getItem:()=>null,setItem:()=>{throw Error('quota');}},{review:true});assert(!failed.save(review.load('dice').state).ok);
console.log('PASS: same puzzle/dice sequence, alternate choices, isolated sessions and records, dedupe, nested review, invalid source and failed storage');
