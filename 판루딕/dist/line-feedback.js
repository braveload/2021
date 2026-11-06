(() => {
  'use strict';
  let observer=null;
  const pos=i=>`${Math.floor(i/5)+1}행 ${i%5+1}열`;
  const direction=cells=>cells[1]-cells[0]===1?'가로':cells[1]-cells[0]===5?'세로':'대각선';
  function decorate(s,C){
    if(s.game!=='line')return;
    observer?.disconnect();
    const board=document.querySelector('#play .line-board');if(!board)return;
    const info=LearningCore.lineFeedback(s,C.lineWindows), recent=info.events.at(-1), wrap=document.createElement('div');wrap.className='line-board-wrap';board.before(wrap);wrap.appendChild(board);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('line-score-overlay');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    svg.innerHTML=info.lines.map(line=>`<line data-score-line="${line.id}" class="score-connection player-${line.player} ${recent?.lines.includes(line.id)?'recent-score':''}" data-first="${line.cells[0]}" data-last="${line.cells[2]}"/>`).join('');wrap.appendChild(svg);
    function position(){const r=board.getBoundingClientRect();if(!r.width||!r.height)return;svg.querySelectorAll('line').forEach(line=>{for(const [key,index]of [['1',line.dataset.first],['2',line.dataset.last]]){const b=board.querySelector(`[data-line-cell="${index}"]`).getBoundingClientRect();line.setAttribute('x'+key,String(((b.left+b.width/2-r.left)/r.width)*100));line.setAttribute('y'+key,String(((b.top+b.height/2-r.top)/r.height)*100));}});}
    position();if(window.ResizeObserver){observer=new ResizeObserver(position);observer.observe(board);}
    document.querySelector('#play .line-gain')?.remove();
    const panel=document.createElement('section');panel.className='line-score-explanation';panel.setAttribute('aria-label','연결선과 득점 이유');
    panel.innerHTML=`<h3>연결선과 득점 이유</h3><p class="line-score-legend">실선: 나 ● · 점선: AI ◆ · 완성된 구간의 연결선은 다음 수에도 남아요.</p><div role="status" aria-live="polite">${info.events.length?info.events.slice(-4).reverse().map(event=>`<div class="line-score-event player-${event.player}"><b>${event.move}수째 · ${event.player===1?'나 ●':'AI ◆'} +${event.points}점</b><p>${event.lines.map(id=>{const cells=C.lineWindows[id];return `${direction(cells)} ${pos(cells[0])} → ${pos(cells[2])}: 3칸 연속 +3점`;}).join('<br>')}</p>${event.lines.length>1?'<small>겹치거나 교차한 구간도 서로 다른 3칸 구간이면 각각 한 번씩 계산해요.</small>':''}</div>`).join(''):'<p>자기 돌을 연속 세 칸으로 이으면 연결선이 생기고 +3점을 얻어요.</p>'}</div><p class="center-score-reason">${s.status==='playing'?`중앙 보너스는 아직 점수에 넣지 않아요. 종료 시 나 ${info.center[0]}칸·AI ${info.center[1]}칸에 각각 1점씩 더해요.`:`경기 종료 · 중앙 보너스 합산: 나 ${info.center[0]}칸 × 1점 = +${info.center[0]}점 / AI ${info.center[1]}칸 × 1점 = +${info.center[1]}점.`}</p>`;
    wrap.after(panel);
  }
  window.LineFeedback={decorate};
})();
