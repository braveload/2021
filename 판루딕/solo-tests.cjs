const assert=require('node:assert/strict'),E=require('./dist/engine.js');
for(const length of [3,4]){
  for(let i=0;i<300;i++){const g=E.createBaseball(length);assert.equal(g.secret.length,length);assert.equal(new Set(g.secret).size,length);assert.match(g.secret,/^\d+$/)}
  const g={...E.createBaseball(length),secret:length===3?'037':'0378'};
  for(const invalid of ['',null,37,'0'.repeat(length),'1'.repeat(length),'1'.repeat(length-1),'1'.repeat(length+1),'abc','１２３','0 3','1e2']){
    const result=E.guessBaseball(g,invalid);assert(result.error);assert.equal(result.game,g);assert.equal(g.attempts.length,0);
  }
  const partial=E.guessBaseball(g,length===3?'073':'0738');assert.equal(partial.game.attempts[0].strikes,length-2);assert.equal(partial.game.attempts[0].balls,2);
  const duplicate=E.guessBaseball(partial.game,partial.game.attempts[0].guess);assert(duplicate.error);assert.equal(duplicate.game,partial.game);
  const won=E.guessBaseball(partial.game,g.secret);assert.equal(won.game.status,'won');assert.equal(won.game.attempts.length,2);assert.equal(won.game.attempts[1].strikes,length);assert(E.guessBaseball(won.game,g.secret).error);
  let failed=g;
  for(let i=0;i<10;i++){const candidate=String(1234+i*109).padStart(4,'0').slice(0,length);if(new Set(candidate).size!==length||candidate===g.secret||failed.attempts.some(a=>a.guess===candidate))continue;failed=E.guessBaseball(failed,candidate).game}
  const candidates=[];for(let i=0;i<10**length&&candidates.length<11;i++){const v=String(i).padStart(length,'0');if(new Set(v).size===length&&v!==g.secret)candidates.push(v)}
  failed=g;for(let i=0;i<10;i++){failed=E.guessBaseball(failed,candidates[i]).game;assert.equal(failed.status,i===9?'lost':'playing')}
  assert.equal(E.guessBaseball(failed,g.secret).game,failed);
  const lastChance={...g,attempts:candidates.slice(0,9).map(guess=>({guess,...E.baseballScore(g.secret,guess)}))};assert.equal(E.guessBaseball(lastChance,g.secret).game.status,'won');
}
assert.deepEqual(E.baseballScore('037','730'),{strikes:1,balls:2});assert.deepEqual(E.baseballScore('0378','1245'),{strikes:0,balls:0});assert.throws(()=>E.createBaseball(5),RangeError);
const random=Math.random;try{Math.random=()=>.999999;assert.equal(E.createBaseball(3).secret,'012')}finally{Math.random=random}
// Enumerate all press combinations independently. A generated board must belong to
// the reachable set; applying the corresponding presses must solve it.
function referencePress(board,index){let next=board,row=Math.floor(index/4),column=index%4;for(const [r,c]of [[row,column],[row-1,column],[row+1,column],[row,column-1],[row,column+1]])if(r>=0&&r<4&&c>=0&&c<4)next^=1<<(4*r+c);return next}
const reachable=new Map();
for(let mask=0;mask<65536;mask++){let board=0;for(let i=0;i<16;i++)if(mask&(1<<i))board=referencePress(board,i);reachable.set(board,mask)}
assert.equal(reachable.size,4096);
for(let i=0;i<16;i++){const board=referencePress(0,i);assert.equal(E.lightsMask(i),board);const initial={board:12345,moves:0,status:'playing'};assert.equal(E.pressLights(E.pressLights(initial,i),i).board,initial.board)}
for(let n=0;n<500;n++){let game=E.createLights();assert.notEqual(game.board,0);assert(reachable.has(game.board));const solution=reachable.get(game.board);for(let i=0;i<16;i++)if(solution&(1<<i))game=E.pressLights(game,i);assert.equal(game.status,'won');assert.equal(game.board,0);assert.equal(E.pressLights(game,0),game)}
const light=E.createLights();for(const invalid of [-1,16,1.5,null])assert.equal(E.pressLights(light,invalid),light);
console.log('PASS: baseball 3/4 digits, leading zero, validation, repeat guesses, scoring, 10th-attempt win/loss; all 65,536 light press combinations and 500 solvable generated boards');
