/* Same rules, separate review sessions. No changes to the game engine. */
(function(root) {
  'use strict';
  const C = typeof module !== 'undefined' ? require('./solo-core.js') : root.SoloCore;
  const clone = x => JSON.parse(JSON.stringify(x));
  function source(s) { const out=clone(s.reviewSource || s); delete out.reviewSource; return out; }
  function create(s, now=Date.now()) {
    if (!C.valid(s) || !['reverse','dice'].includes(s.game) || s.status === 'playing') throw Error('완료된 불빛/주사위 경기만 복습할 수 있습니다.');
    const origin=source(s);
    let out;
    if (s.game === 'dice') out=C.create('dice',{seed:origin.seed,now});
    else {
      out=clone(origin); Object.assign(out,{status:'playing',revision:0,startedAt:now,updatedAt:now,finishedAt:null});
      out.data.board=out.data.initialBoard; out.data.moves=0;
    }
    out.id=`review-${s.game}-${origin.seed}-${now}`;
    out.reviewSource=origin;
    return out;
  }
  function valid(s) {
    if (!C.valid(s) || !s.reviewSource || s.reviewSource.reviewSource) return false;
    const origin=s.reviewSource;
    return C.valid(origin) && ['reverse','dice'].includes(s.game) && origin.game===s.game && origin.status!=='playing'
      && origin.seed===s.seed && origin.ruleVersion===s.ruleVersion
      && (s.game!=='reverse' || origin.data.initialBoard===s.data.initialBoard);
  }
  function tripleGoal(correct,errors) {
    return correct<4 ? `다음 목표: 정답 라운드를 ${correct+1}개로 늘려보세요.` : correct<6 ? '다음 목표: 6라운드 모두 맞히기에 도전하세요.' : errors ? '다음 목표: 오답 없이 6라운드를 완주해보세요.' : '다음 목표: 개인 최고점 갱신에 도전하세요.';
  }
  const api={create,valid,source,tripleGoal};
  if(typeof module!=='undefined')module.exports=api;
  root.ReplayCore=api;
})(typeof window==='undefined'?globalThis:window);
