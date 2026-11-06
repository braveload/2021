/* Separate, ephemeral lesson board; never writes to game sessions or records. */
(() => {
  'use strict';
  const C=SoloCore, L=LearningCore, dialog=document.createElement('dialog');
  dialog.id='lights-practice';dialog.setAttribute('aria-labelledby','lights-practice-title');document.body.appendChild(dialog);
  let lesson=0, board=C.TARGET, moves=0, guide=false, last=null;
  function firstSolution(){const mask=C.solution(board);for(let i=0;i<16;i++)if(mask&(1<<i))return i;return null;}
  function reset(){const p=L.lightLessons[lesson];board=p.presses.reduce((b,i)=>b^C.mask(i),C.TARGET);moves=0;guide=p.guide;last=null;render();}
  function paint(index){const mask=index===null?0:C.mask(index);dialog.querySelectorAll('[data-learn-light]').forEach(b=>b.classList.toggle('will-flip',!!(mask&(1<<Number(b.dataset.learnLight)))));}
  function render(){
    const solved=board===C.TARGET, p=L.lightLessons[lesson], hint=guide&&!solved?firstSolution():null;
    dialog.innerHTML=`<div class="dialog-head"><span>그림으로 배우기 · ${lesson+1}/3</span><button type="button" data-light-close aria-label="불빛 연습 닫기">닫기</button></div><h2 id="lights-practice-title" tabindex="-1">불빛 뒤집기 · 그림 연습</h2><p class="practice-note">시간·횟수 제한과 기록 부담 없이 연습해요. 실제 게임의 진행·모드·완료 기록은 그대로 유지됩니다.</p><h3>${p.title}</h3><p>밝은 칸이 켜진 불이에요. 한 칸을 누르면 그 칸과 상하좌우가 함께 바뀝니다.</p><div class="light-practice-legend"><span>밝은 칸: 켜짐</span><span>짙은 칸: 꺼짐</span><span>점선: 함께 바뀔 칸</span></div><div class="reverse-board practice-light-board" role="group" aria-label="연습용 4행 4열 불빛 보드">${Array.from({length:16},(_,i)=>{const on=!(board&(1<<i));return `<button type="button" class="reverse-tile ${on?'is-light':''} ${hint===i?'practice-light-hint':''}" data-learn-light="${i}" aria-label="연습 ${Math.floor(i/4)+1}행 ${i%4+1}열 ${on?'켜짐':'꺼짐'}${hint===i?' · 여기를 눌러보세요':''}" ${solved?'disabled':''}>${on?'●':'○'}${hint===i?'<small>눌러보기</small>':''}</button>`;}).join('')}</div><p class="light-practice-status" role="status" aria-live="polite">${solved?'모든 불을 껐어요! 연습 결과는 실제 기록에 포함되지 않아요.':last!==null?`${Math.floor(last/4)+1}행 ${last%4+1}열을 눌러 ${Array.from({length:16},(_,i)=>!!(C.mask(last)&(1<<i))).filter(Boolean).length}칸을 뒤집었어요. 조작 ${moves}회 · 남은 켜진 불 ${Array.from({length:16},(_,i)=>!(board&(1<<i))).filter(Boolean).length}개`:hint!==null?'표시된 칸을 눌러보세요. 점선 칸도 함께 뒤집혀요.':'칸을 가리키거나 키보드로 선택하면 함께 바뀔 칸을 확인할 수 있어요.'}</p><div class="actions practice-actions"><button type="button" data-light-reset>이 연습 다시 하기</button><button type="button" data-light-hint ${solved?'disabled':''}>누를 칸 힌트</button>${solved&&lesson<2?'<button type="button" class="primary" data-light-next>다음 연습 →</button>':''}</div><button type="button" class="practice-entry light-return" data-light-close>${solved&&lesson===2?'연습 완료 · 실제 게임으로 돌아가기':'실제 게임으로 돌아가기'}</button>`;
    paint(hint);
  }
  function open(){lesson=0;reset();dialog.showModal();dialog.querySelector('h2').focus();}
  dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-light-close'))dialog.close();else if(b.hasAttribute('data-light-reset'))reset();else if(b.hasAttribute('data-light-hint')){guide=true;render();}else if(b.hasAttribute('data-light-next')){lesson++;reset();dialog.querySelector('h2').focus();}else if(b.hasAttribute('data-learn-light')){last=Number(b.dataset.learnLight);board^=C.mask(last);moves++;render();const target=dialog.querySelector(`[data-learn-light="${last}"]`);if(!target.disabled)target.focus();}});
  for(const type of ['pointerover','focusin'])dialog.addEventListener(type,e=>{const b=e.target.closest('[data-learn-light]');if(b&&!b.disabled)paint(Number(b.dataset.learnLight));});
  const button=document.createElement('button');button.type='button';button.className='practice-entry';button.textContent='시간제한 없는 그림 연습';button.addEventListener('click',open);document.querySelector('.solo-tools').prepend(button);
  if(new URLSearchParams(location.search).get('practice')==='1')open();
})();
