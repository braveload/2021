(function () {
  'use strict';
  const list = document.getElementById('game-list'); if (!list) return;
  const games = [
    ['code', '코드 브레이커', '암호 추리 · 8회 도전'],
    ['dice', '전략 주사위', '배치 전략 · 9턴']
  ];
  list.insertAdjacentHTML('beforeend', games.map(([id, name, tag]) => `<article class="game-card suite-feature ${id}"><a class="game-launch" href="solo.html?game=${id}" aria-label="${name} 바로 플레이"><span class="card-cover"><img src="assets/solo-${id}.svg" alt="" width="326" height="130" loading="lazy"></span><span class="card-body"><strong class="game-name">${name}</strong><span class="tags">${tag.split(' · ').map(t => `<span>${t}</span>`).join('')}<span>싱글 1인</span></span><span class="card-play" aria-hidden="true">바로 플레이 →</span></span></a></article>`).join(''));
})();
