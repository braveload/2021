(function () {
  'use strict';
  const list = document.getElementById('game-list'); if (!list) return;
  const games = [
    ['code', '코드 브레이커', '0~7 · 4자리 · 8회', 'code-breaker.html'],
    ['dice', '전략 주사위', '배치 전략 · 9턴', 'dice-strategy.html'],
    ['chain', '숫자 연쇄', '카드 연결 · 12턴', 'number-chain.html'],
    ['line', '라인 컨트롤', '영역 전략 · AI 대전', 'line-control.html']
  ];
  list.insertAdjacentHTML('beforeend', games.map(([id, name, tag, route]) => `<article class="game-card suite-feature ${id}"><a class="game-launch" href="${route}" aria-label="${name} 바로 플레이"><span class="card-cover"><img src="assets/solo-${id}.svg" alt="" width="326" height="130" loading="lazy"></span><span class="card-body"><strong class="game-name">${name}</strong><span class="tags">${tag.split(' · ').map(t => `<span>${t}</span>`).join('')}<span>싱글 1인</span></span><span class="card-play" aria-hidden="true">바로 플레이 →</span></span></a><button class="card-rules" data-suite-rules="${id}" aria-label="${name} 방법 보기">방법 보기</button></article>`).join(''));
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-suite-rules]'); if (!button) return;
    const id = button.dataset.suiteRules, entry = games.find(g => g[0] === id); if (!entry) return;
    const dialog = document.getElementById('game-rules');
    document.getElementById('game-rules-content').innerHTML = `<h2 id="rules-heading">${entry[1]} · 방법 보기</h2><ol class="rules">${SoloRules[id].map(text => `<li>${text}</li>`).join('')}</ol><a class="button primary" href="${entry[3]}">바로 플레이 →</a>`;
    Sound.play('select'); dialog.showModal();
  });
})();
