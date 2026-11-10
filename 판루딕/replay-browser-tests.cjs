const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const C=require('./dist/solo-core.js');
const base=process.env.SOLO_TEST_URL||'http://127.0.0.1:4192',out=process.env.SOLO_TEST_OUTPUT||__dirname;
let browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 await p.goto(base+'/lights.html');await p.locator('#lights-mode').waitFor();
 // Old records, including hidden game and independent code result, must remain byte-identical.
 const fixture=C.apply(C.create('code',{seed:111,now:100}),{type:'guess',value:C.create('code',{seed:111,now:100}).data.secret},200).state;
 const oldRows=JSON.stringify([C.record(fixture)]),oldPopup='[{"id":"nine","score":3,"complete":true,"time":"2026-11-01T00:00:00.000Z"}]';
 let lights=C.create('reverse',{seed:98,mode:'challenge',difficulty:'normal'});
 await p.evaluate(({s,oldRows,oldPopup})=>{localStorage.setItem('panludiq.solo.reverse.session.v1',JSON.stringify(s));localStorage.setItem('panludiq.solo.records.v1',oldRows);localStorage.setItem('panludiq.records.v1',oldPopup);localStorage.setItem('panludiq.lights.v1','[{"moves":8,"time":"2026-11-01T00:00:00.000Z"}]');},{s:lights,oldRows,oldPopup});await p.reload();
 const get=key=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const solve=async(key)=>{const s=await get(key),bits=C.solution(s.data.board);for(let i=0;i<16;i++)if(bits&(1<<i))await p.locator(`[data-press="${i}"]`).click();};
 await p.locator('[data-press="0"]').click();await p.locator('[data-press="0"]').click();await solve('panludiq.solo.reverse.session.v1');
 assert((await p.locator('.replay-feedback').innerText()).includes('2회 더'));assert((await p.locator('.replay-feedback').innerText()).includes('최소 기록'));
 const regularLight=await get('panludiq.solo.reverse.session.v1'),normalRows=await p.evaluate(()=>localStorage.getItem('panludiq.solo.records.v1'));
 // Refuse a review-mode switch when storage cannot save it.
 await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('panludiq.review.'))throw Error('quota');return window.originalSet.call(this,k,v);};});
 await p.locator('[data-review]').click();assert.equal(await p.locator('.review-mode').count(),0);await p.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});await p.locator('[data-review]').click();
 assert.equal(await p.locator('.review-mode').count(),1);let rs=await get('panludiq.review.reverse.session.v1');assert.equal(rs.data.initialBoard,regularLight.data.initialBoard);
 const bit=C.solution(rs.data.board),idx=Array.from({length:16},(_,i)=>i).find(i=>bit&(1<<i));await p.locator(`[data-press="${idx}"]`).click();rs=await get('panludiq.review.reverse.session.v1');await p.reload();await p.locator('.review-mode').waitFor();assert.deepEqual(await get('panludiq.review.reverse.session.v1'),rs);
 await solve('panludiq.review.reverse.session.v1');assert((await p.locator('.review-comparison').innerText()).includes('원래 도전'));await p.reload();await p.locator('[data-review]').waitFor();assert.equal((await get('panludiq.review.records.v1')).filter(r=>r.game==='reverse').length,1);assert.equal(await p.evaluate(()=>localStorage.getItem('panludiq.solo.records.v1')),normalRows);assert.deepEqual(await get('panludiq.solo.reverse.session.v1'),regularLight);
 await p.locator('#open-records').click();assert((await p.locator('#record-list').innerText()).includes('복습 완료 기록'));await p.locator('[data-close="solo-records"]').click();
 await p.screenshot({path:path.join(out,'lights-result-pc.png'),fullPage:true});await p.locator('[data-new]').click();assert.equal(await p.locator('.review-mode').count(),0);assert.equal((await get('panludiq.solo.reverse.session.v1')).data.difficulty,'normal');
 await p.goto(base+'/dice-strategy.html');await p.locator('[data-select="0"]').waitFor();const pairs=[];
 const place=async(i,choice)=>{await p.locator(`[data-select="${choice}"]`).click();await p.locator(`[data-place="${i}"]`).click();await p.locator('[data-confirm-place]').click();};
 for(let i=0;i<9;i++){pairs.push((await get('panludiq.solo.dice.session.v1')).data.pair);await place(i,0);}
 assert((await p.locator('.dice-breakdown[open]').innerText()).includes('가로 보너스 합계'));assert((await p.locator('.dice-breakdown[open]').innerText()).includes('미달성'));
 const regularDice=await get('panludiq.solo.dice.session.v1'),beforeReviewRows=await p.evaluate(()=>localStorage.getItem('panludiq.solo.records.v1'));
 await p.locator('[data-review]').click();for(let i=0;i<9;i++){
  const s=await get('panludiq.review.dice.session.v1');assert.deepEqual(s.data.pair,pairs[i]);
  if(i===3){await p.locator('[data-select="1"]').click();const mid=await get('panludiq.review.dice.session.v1');await p.reload();await p.locator('.review-mode').waitFor();assert.deepEqual(await get('panludiq.review.dice.session.v1'),mid);}
  if(i===8)await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='panludiq.review.records.v1')throw Error('quota');return window.originalSet.call(this,k,v);};});
  await place(8-i,1);
 }
 assert((await p.locator('#save-status').innerText()).includes('저장하지 못함'));await p.locator('[data-new]').click();assert.equal(await p.locator('.review-mode').count(),1); // Don't overwrite unsaved completion.
 await p.reload();await p.locator('[data-review]').waitFor();assert.equal((await get('panludiq.review.records.v1')).filter(r=>r.game==='dice').length,1);assert((await p.locator('.review-comparison').innerText()).includes('가로 보너스'));await p.reload();await p.locator('[data-review]').waitFor();assert.equal((await get('panludiq.review.records.v1')).filter(r=>r.game==='dice').length,1);
 assert.equal(await p.evaluate(()=>localStorage.getItem('panludiq.solo.records.v1')),beforeReviewRows);assert.deepEqual(await get('panludiq.solo.dice.session.v1'),regularDice);
 for(const width of [1280,390,320]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(out,`dice-result-${width}.png`),fullPage:true});}
 await p.locator('[data-new]').click();assert.equal(await p.locator('.review-mode').count(),0);
 await p.goto(base+'/index.html');await p.getByRole('button',{name:'트리플 코드 바로 플레이',exact:true}).click();if(await p.locator('#triple-practice[open]').count())await p.locator('[data-practice-challenge]').click();await p.locator('#submit').waitFor();
 // Three wrong submissions: no in-round solution leak, then explicit feedback.
 const wrong=await p.evaluate(()=>{for(let a=0;a<7;a++)for(let b=a+1;b<8;b++)for(let c=b+1;c<9;c++)if(!E.matches(state.puzzle.cards,[a,b,c],state.puzzle.target))return[a,b,c];});
 for(const i of wrong)await p.locator('.triple .tile').nth(i).click();
 for(let n=0;n<3;n++){await p.locator('#submit').click();if(n<2)assert.equal(await p.locator('.triple-review').count(),0);}
 assert((await p.locator('.triple-review').innerText()).includes('불일치'));assert((await p.locator('.triple-review').innerText()).includes('마지막 제출'));
 for(let round=1;round<=6;round++){
  if(round>1){
   if(round===2){await p.evaluate(()=>clock(0,()=>tripleEnd(false,'시간초과'),()=>{}));await p.locator('#triple-next').waitFor();await p.reload();await p.locator('#triple-next').waitFor();assert((await p.locator('.triple-review').innerText()).includes('제출한 조합이 없어'));}
   else {const answer=await p.evaluate(()=>state.puzzle.answer);for(const i of answer)await p.locator('.triple .tile').nth(i).click();await p.locator('#submit').click();assert((await p.locator('#triple-review-heading').innerText()).includes('내가 맞힌'));assert.equal(await p.locator('.triple-review details[open]').count(),0);assert((await p.locator('.triple-correct-summary').innerText()).includes('✓'));}
  }
  const snapshot=await p.evaluate(()=>({score:state.score,round:state.round,review:state.roundReview,puzzle:state.puzzle}));await p.waitForTimeout(1700);assert.equal(await p.evaluate(()=>state.round),round);await p.reload();await p.locator('#triple-next').waitFor();assert.deepEqual(await p.evaluate(()=>({score:state.score,round:state.round,review:state.roundReview,puzzle:state.puzzle})),snapshot);
  if(round===3){await p.screenshot({path:path.join(out,'triple-review-mobile.png'),fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.locator('#triple-next').click();
 }
 assert((await p.locator('.triple-goal').last().innerText()).includes('6라운드 모두'));const popupRows=await get('panludiq.records.v1');assert.equal(popupRows.filter(r=>r.id==='triple').length,1);assert(popupRows.some(r=>r.id==='nine'&&r.score===3));await p.reload();assert.equal((await get('panludiq.records.v1')).filter(r=>r.id==='triple').length,1);
 assert.deepEqual(errors,[]);const result={passed:true,base,lightMinimumAndSamePuzzle:true,diceNinePairsUnchangedWithDifferentChoices:true,reviewProgressAndResultReload:true,normalRecordsAndSessionsPreserved:true,reviewRecordsSeparateAndDeduplicated:true,quotaFailureRecovery:true,tripleWrongTimeoutCorrectFeedback:true,tripleManualNextAndReviewReload:true,tripleFinalGoal:true,widths:[1280,390,320],errors};fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
