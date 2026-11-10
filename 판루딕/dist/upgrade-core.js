(function(root){
'use strict';
function notes(value,count){return Array.from({length:count},(_,i)=>[0,1,2].includes(value?.[i])?value[i]:0);}
function noteMarkup(value,count){const a=notes(value,count);return `<details class="digit-notes"><summary>나만의 숫자 메모</summary><p>누를 때마다 미정 → 후보 → 제외. 정답 판정과 관계없는 개인 메모예요.</p><div class="note-digits">${a.map((v,i)=>`<button type="button" data-digit-note="${i}" data-mark="${v}" aria-label="${i}: ${['미정','후보','제외'][v]}">${i}<small>${['미정','후보','제외'][v]}</small></button>`).join('')}</div><button type="button" data-note-reset>메모 비우기</button></details>`;}
function cross(i){return Array.from({length:16},(_,j)=>j).filter(j=>Math.abs(Math.floor(j/4)-Math.floor(i/4))+Math.abs(j%4-i%4)<=1);}
function turns(route){let n=0,prev=null;for(let i=1;i<(route||[]).length;i++){const dx=Math.sign(route[i][0]-route[i-1][0]),dy=Math.sign(route[i][1]-route[i-1][1]),dir=`${dx},${dy}`;if(!dx&&!dy)continue;if(prev&&prev!==dir)n++;prev=dir;}return n;}
function forecast(s,index,C){const out=C.apply(s,{type:'remove',index},s.updatedAt);if(out.error)return null;const seen=new Set();let groups=0;out.state.data.board.forEach((v,i)=>{if(v===null||seen.has(i))return;const g=C.popGroup(out.state.data.board,i);g.forEach(j=>seen.add(j));if(g.length>=2)groups++;});return {points:out.state.score-s.score,remaining:out.state.data.board.filter(v=>v!==null).length,groups};}
root.GameUpgrade={notes,noteMarkup,cross,turns,forecast};if(typeof module!=='undefined')module.exports=root.GameUpgrade;
})(typeof window==='undefined'?globalThis:window);
