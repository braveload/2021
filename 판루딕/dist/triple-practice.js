/* Independent practice: no shared game state or score/history storage writes. */
(() => {
  'use strict';
  const L = LearningCore, originalLaunch = launchGame;
  let lesson = 0, selected = [], solved = false, shown = false, practiceFinished = false;
  const labels = ['모양','개수','무늬'], names = [['원','삼각형','사각형'],['1개','2개','3개'],['빈 무늬','줄 무늬','채운 무늬']];
  const dialog = document.createElement('dialog'); dialog.id = 'triple-practice'; dialog.setAttribute('aria-labelledby','practice-title');
  document.body.appendChild(dialog);
  function symbols(card, key) { return `<span class="triple-symbols" style="color:${['#246cf0','#8952d8','#12877e'][card[0]]}">${Array.from({length:card[1]+1},(_,i)=>tripleSymbol(card, 'learn-'+key+'-'+i)).join('')}<small class="pattern">${names[2][card[2]]}</small></span>`; }
  function render() {
    const p = L.lessons[lesson], rows = L.feedback(p.cards, selected, p.target);
    dialog.innerHTML = `<div class="dialog-head"><span>그림으로 배우기 · ${lesson+1}/3</span><button type="button" data-practice-close aria-label="연습 닫기">닫기</button></div><h2 id="practice-title" tabindex="-1">트리플 코드 · 시간제한 없는 연습</h2><p class="practice-note">시간·점수·오답 제한 없이 연습해요. 실제 도전의 진행과 기록은 바뀌지 않아요.</p><div class="practice-target">${p.target.map((same,i)=>`<span><b>${labels[i]}</b> ${same?'모두 같음':'모두 다름'}</span>`).join('')}</div><p>세 조건을 모두 만족하는 카드 3장을 골라보세요.</p><div class="board triple practice-board">${p.cards.map((c,i)=>`<button type="button" class="tile ${selected.includes(i)?'selected':''}" data-practice-card="${i}" aria-pressed="${selected.includes(i)}" aria-label="연습 ${i+1}번 ${names[0][c[0]]} ${names[1][c[1]]} ${names[2][c[2]]}">${symbols(c,i)}</button>`).join('')}</div><div class="practice-feedback" role="status" aria-live="polite">${rows ? rows.map(r=>`<div class="practice-check ${shown?(r.ok?'is-correct':'is-wrong'):''}"><b>${labels[r.axis]}</b><div class="practice-values">${selected.map(i=>`<span>${r.axis===0?symbols([p.cards[i][0],0,0],'shape-'+i):r.axis===1?'●'.repeat(p.cards[i][1]+1):symbols([0,0,p.cards[i][2]],'fill-'+i)}<small>${names[r.axis][p.cards[i][r.axis]]}</small></span>`).join('')}</div><span>${shown?(r.ok?'✓ 조건에 맞아요':'다시 살펴보세요'):''}<small>${p.target[r.axis]?'세 장이 모두 같아야 해요':'세 장이 서로 달라야 해요'}</small></span></div>`).join('') : `<p>${selected.length}/3장 선택 · 카드는 다시 눌러 선택을 취소할 수 있어요.</p>`}${shown?`<p class="practice-outcome">${solved?'세 조건을 모두 맞혔어요. 그림에서 같은 점과 다른 점을 확인해보세요.':'점수는 줄지 않아요. 조건별 그림을 비교하고 다시 골라보세요.'}</p>`:''}</div><div class="actions practice-actions"><button type="button" data-practice-check class="primary" ${selected.length!==3?'disabled':''}>그림으로 확인</button><button type="button" data-practice-hint>정답 그림 보기</button>${solved&&lesson<2?'<button type="button" data-practice-next>다음 연습 →</button>':''}</div><div class="practice-challenge"><button type="button" data-practice-challenge>${active?'진행 중인 도전으로 돌아가기':solved&&lesson===2?'연습 완료 · 실제 도전 시작':'연습 건너뛰고 실제 도전'}</button><small>실제 도전은 6라운드 · 라운드당 40초입니다.</small></div>`;
  }
  function open() { lesson=0; selected=[]; solved=shown=false; render(); dialog.showModal(); document.getElementById('practice-title').focus(); }
  dialog.addEventListener('click', e => {
    const b=e.target.closest('button'); if(!b||b.disabled)return;
    if(b.hasAttribute('data-practice-close'))dialog.close();
    else if(b.hasAttribute('data-practice-card')){const i=Number(b.dataset.practiceCard);if(selected.includes(i))selected=selected.filter(x=>x!==i);else if(selected.length<3)selected.push(i);solved=shown=false;render();dialog.querySelector(`[data-practice-card="${i}"]`).focus();}
    else if(b.hasAttribute('data-practice-check')){shown=true;solved=L.feedback(L.lessons[lesson].cards,selected,L.lessons[lesson].target).every(r=>r.ok);if(solved&&lesson===2)practiceFinished=true;render();dialog.querySelector('.practice-outcome')?.scrollIntoView({block:'nearest'});}
    else if(b.hasAttribute('data-practice-hint')){selected=L.lessons[lesson].answer.slice();shown=solved=true;if(lesson===2)practiceFinished=true;render();}
    else if(b.hasAttribute('data-practice-next')){lesson++;selected=[];solved=shown=false;render();document.getElementById('practice-title').focus();}
    else if(b.hasAttribute('data-practice-challenge')){practiceFinished=true;dialog.close();if(!active){if(document.querySelector('#game-rules').open)document.querySelector('#game-rules').close();originalLaunch('triple');}}
  });
  function previousPlay() {
    try { return !!localStorage.getItem('panludiq.popup.triple.v1') || JSON.parse(localStorage.getItem('panludiq.records.v1')||'[]').some(r=>r.id==='triple'); } catch { return true; }
  }
  launchGame = function(id) { if(id==='triple'&&!active&&!practiceFinished&&!previousPlay()){open();return;} return originalLaunch(id); };
  const rules = showGameRules;
  showGameRules = function(id){const value=rules(id);if(id==='triple'){const b=document.createElement('button');b.type='button';b.className='practice-entry';b.textContent='시간제한 없는 그림 연습';b.addEventListener('click',()=>{document.querySelector('#game-rules').close();open();});document.querySelector('#game-rules-content').appendChild(b);}return value;};
  window.TriplePractice={open};
})();
