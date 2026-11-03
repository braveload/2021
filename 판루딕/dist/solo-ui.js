(function () {
  'use strict';
  const C = SoloCore, $ = selector => document.querySelector(selector), params = new URLSearchParams(location.search);
  const requested = params.get('game'), game = Object.hasOwn(C.GAMES, requested) ? requested : 'code';
  const escape = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let storage;
  try { storage = localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
  const store = SoloStore.create(storage);
  const rules = {
    code: ['0~7 중 서로 다른 숫자 네 개로 만든 암호를 맞힙니다. 첫 자리 0도 가능합니다.', '위치까지 일치한 개수와 숫자만 포함된 개수를 알려줍니다. 어떤 숫자가 맞았는지는 알려주지 않습니다.', '유효한 제출은 최대 8회입니다. 잘못된 입력과 이미 제출한 숫자는 횟수를 쓰지 않습니다.', '8번째 제출도 정답이면 성공입니다. 첫 시도 1,000점에서 추가 시도마다 100점이 줄고 실패는 0점입니다.', '새로고침해도 암호와 시도 기록은 유지됩니다. 힌트와 시간 제한은 없습니다.'],
    reverse: ['한 칸을 누르면 그 칸과 상하좌우가 반전됩니다. 대각선과 보드 바깥은 영향을 받지 않습니다.', '어두운 칸을 없애고 16칸을 모두 밝게 만들면 성공입니다. 모든 문제는 풀 수 있게 생성합니다.', '최대 25회 조작할 수 있습니다. 25번째 조작으로 완성해도 성공입니다.', '10회 이내 별 3개, 16회 이내 별 2개, 25회 이내 별 1개입니다. 별 기준은 초기 검수용입니다.', '힌트·되돌리기는 없습니다. 새 도전은 다른 문제로 바뀌며, 새로고침은 같은 진행을 불러옵니다.'],
    dice: ['매 턴 주사위 두 개 중 하나를 고른 뒤 빈칸에 배치합니다. 같은 눈 두 개가 나올 수도 있습니다.', '배치 전에는 선택을 바꿀 수 있습니다. 놓은 주사위는 이동하거나 취소할 수 없습니다. 9칸을 채우면 완료됩니다.', '모든 눈의 합이 기본점수입니다. 완성된 가로줄 합이 10~14이면 줄마다 +10점입니다.', '완성된 세로줄의 세 숫자가 모두 다르면 줄마다 +8점입니다.', '두 대각선은 각각 세 숫자가 모두 홀수이거나 모두 짝수이면 +6점입니다.', '빈칸이 남은 줄에는 보너스가 없습니다. 화면 점수는 현재 배치 기준이며, 최종 등급은 아직 부여하지 않습니다.']
  };
  const descriptions = { code: '숫자 네 개, 여덟 번의 기회. 단서로 암호를 좁혀보세요.', reverse: '누른 칸과 주변을 뒤집어, 모든 타일을 밝게 만드세요.', dice: '두 눈 중 하나를 고르고, 아홉 칸의 조합을 완성하세요.' };
  let state, draft = '';
  function warn(message) { if (message) { $('#save-warning').hidden = false; $('#save-warning').textContent = message; } }
  function save() {
    const saved = store.save(state);
    $('#save-status').textContent = saved.ok ? (state.status === 'playing' ? '이 브라우저에 진행을 저장했습니다.' : '완료 기록을 이 브라우저에 저장했습니다.') : '저장하지 못함 · 현재 페이지에서 플레이 가능';
    if (!saved.ok) warn(saved.error);
  }
  function focus(selector) { if (!document.querySelector('dialog[open]')) $(selector)?.focus({ preventScroll: true }); }
  function newState() {
    const value = new Uint32Array(1); let seed = Date.now();
    if (globalThis.crypto?.getRandomValues) { crypto.getRandomValues(value); seed = value[0]; }
    state = C.create(game, { seed }); draft = ''; save(); render();
    $('#move-message').textContent = '새 도전을 시작했습니다.'; focus(game === 'code' ? '#code-guess' : '#phase-heading');
  }
  function execute(action, focusSelector) {
    const result = C.apply(state, action);
    if (result.error) {
      $('#move-message').textContent = result.error; Sound.play('wrong');
      if (game === 'code') { $('#code-guess')?.setAttribute('aria-invalid', 'true'); focus('#code-guess'); }
      return;
    }
    state = result.state; if (game === 'code') draft = ''; save(); render();
    const r = C.result(state);
    if (r.terminal) { $('#move-message').textContent = state.status === 'lost' ? '이번 도전이 끝났습니다. 결과와 기록을 확인하세요.' : '도전을 완료했습니다. 결과와 기록을 확인하세요.'; Sound.play(state.status === 'lost' ? 'lose' : 'win'); focus('#phase-heading'); }
    else {
      $('#move-message').textContent = game === 'code' ? `위치 일치 ${state.data.attempts.at(-1).exact}개 · 숫자만 일치 ${state.data.attempts.at(-1).misplaced}개. ${8 - state.data.attempts.length}회 남았습니다.` : game === 'reverse' ? `${state.data.moves}회 조작 · 밝은 칸 ${brightCount()}/16` : action.type === 'select' ? `${state.data.pair[state.data.selected]}을 선택했습니다. 빈칸에 놓으세요.` : `${state.data.turns}/9칸 배치 · 현재 ${r.score}점. 다음 주사위를 선택하세요.`;
      Sound.play('select'); if (focusSelector) focus(focusSelector);
    }
  }
  function brightCount() { let x = state.data.board, n = 0; while (x) { x &= x - 1; n++; } return n; }
  function banner() {
    const r = C.result(state); if (!r.terminal) return '';
    const success = state.status !== 'lost';
    const heading = game === 'dice' ? '아홉 칸을 완성했어요!' : success ? (game === 'code' ? '암호를 찾았어요!' : '모든 타일이 밝아졌어요!') : (game === 'code' ? '여덟 번의 도전이 끝났어요.' : '25회 조작이 끝났어요.');
    const value = game === 'code' ? `${r.score}점` : game === 'reverse' ? (success ? `${'★'.repeat(r.stars)} · ${r.moves}회` : `${r.moves}회 · 미완성`) : `${r.score}점`;
    return `<div class="result-band ${success ? '' : 'failed'}"><h2 id="phase-heading" tabindex="-1">${heading}</h2><p class="result-value">${value}</p>${game === 'code' ? `<p>정답 <strong class="result-answer">${state.data.secret}</strong></p>` : ''}<div class="result-actions"><button class="primary" data-new>새 도전</button><button data-records>내 기록</button><a class="button" href="index.html#games">게임 목록</a></div></div>`;
  }
  function codeView() {
    const d = state.data, playing = state.status === 'playing';
    return `${banner()}<div class="play-status"><span>도전 <strong>${d.attempts.length}<small> / 8</small></strong></span><span>0~7 · 중복 없는 4자리</span></div>${playing ? '<h2 id="phase-heading" tabindex="-1" class="visually-hidden">암호 추리</h2>' : ''}<p class="short-rule">위치까지 일치한 개수와 숫자만 일치한 개수를 확인하세요.</p><div class="code-secret" aria-label="${playing ? '비밀 암호 네 자리' : '정답 암호'}">${Array.from({ length: 4 }, (_, i) => `<span>${playing ? '?' : d.secret[i]}</span>`).join('')}</div>${playing ? `<form id="code-form" class="code-entry" novalidate><label for="code-guess">추리한 숫자 네 자리</label><div class="code-entry-line"><input id="code-guess" type="text" inputmode="numeric" maxlength="4" autocomplete="off" spellcheck="false" aria-describedby="move-message" value="${escape(draft)}" placeholder="예: 0367"><button class="primary" type="submit">확인 →</button></div><div class="digit-pad" aria-label="숫자 입력">${Array.from({ length: 8 }, (_, i) => `<button type="button" data-digit="${i}" aria-label="숫자 ${i} 입력">${i}</button>`).join('')}</div></form>` : ''}<ol class="attempts" aria-label="이전 추리 기록">${d.attempts.map((a, i) => `<li><span class="attempt-number">${i + 1}회</span><strong class="guess">${a.guess}</strong><span class="hint">위치 <b>${a.exact}</b> · 숫자만 ${a.misplaced}</span></li>`).join('')}</ol>`;
  }
  function reverseView() {
    const d = state.data, playing = state.status === 'playing';
    return `${banner()}${playing ? '<h2 id="phase-heading" tabindex="-1" class="visually-hidden">타일 뒤집기</h2>' : ''}<div class="play-status"><span>조작 <strong>${d.moves}<small> / 25</small></strong></span><span>밝은 칸 <strong>${brightCount()}<small> / 16</small></strong></span></div><p class="short-rule">한 칸과 상하좌우를 뒤집습니다. 모두 밝게 만들면 성공!</p><div class="reverse-board" role="group" aria-label="4행 4열 타일 퍼즐">${Array.from({ length: 16 }, (_, i) => { const bright = !!(d.board & 1 << i); return `<button class="reverse-tile ${bright ? 'is-light' : ''}" data-press="${i}" aria-pressed="${bright}" aria-label="${Math.floor(i / 4) + 1}행 ${i % 4 + 1}열 ${bright ? '밝음' : '어두움'}, 누르면 상하좌우 반전" ${playing ? '' : 'disabled'}><span aria-hidden="true">${bright ? '○' : '●'}</span></button>`; }).join('')}</div><div class="reverse-legend"><span><i class="bright"></i>목표: 모두 밝음</span><span><i></i>어두운 타일</span></div><p class="reverse-limit">10회 ★★★ · 16회 ★★ · 25회 ★ · 초기 별 기준</p>`;
  }
  function breakdown() {
    const d = C.diceScore(state.data.board), labels = ['가로', '세로', '대각선'];
    return `<details class="dice-breakdown" ${state.status === 'playing' ? '' : 'open'}><summary>현재 점수 계산 보기</summary><ul class="score-breakdown"><li><span>눈의 합</span><b>${d.base}점</b></li>${[d.rows, d.columns, d.diagonals].flatMap((list, axis) => list.map((score, i) => `<li><span>${labels[axis]} ${i + 1}</span><b>+${score}점</b></li>`)).join('')}<li><strong>합계</strong><strong>${d.total}점</strong></li></ul><p>빈칸이 있는 줄은 보너스 0점입니다.</p></details>`;
  }
  function diceView() {
    const d = state.data, playing = state.status === 'playing';
    return `${banner()}${playing ? '<h2 id="phase-heading" tabindex="-1" class="visually-hidden">주사위 배치</h2>' : ''}<div class="play-status"><span>배치 <strong>${d.turns}<small> / 9</small></strong></span><span>현재 점수 <strong class="score-number">${C.diceScore(d.board).total}<small>점</small></strong></span></div><div class="dice-layout"><div><p class="short-rule">눈의 합 + 완성된 가로·세로·대각선 보너스</p><div class="dice-board" role="group" aria-label="3행 3열 주사위 배치판">${d.board.map((n, i) => `<button class="dice-cell ${n === null ? '' : 'filled'}" data-place="${i}" aria-label="${Math.floor(i / 3) + 1}행 ${i % 3 + 1}열 ${n === null ? '빈칸에 배치' : `주사위 ${n}` }" ${n !== null || !playing ? 'disabled' : ''}>${n === null ? '<span aria-hidden="true">＋</span>' : n}</button>`).join('')}</div></div><div>${playing ? `<section class="dice-offer" aria-label="이번 턴 주사위"><h3>${d.turns + 1}턴 · 하나를 고르세요</h3><p>선택 후 빈칸을 누르면 배치됩니다.</p><div class="dice-pair">${d.pair.map((n, i) => `<button data-select="${i}" aria-pressed="${d.selected === i}" aria-label="${i + 1}번 주사위 ${n} 선택"><span>${n}</span><small>${i + 1}번 주사위</small></button>`).join('')}</div><p class="dice-selection">${d.selected === null ? '아직 선택하지 않았습니다.' : `${d.pair[d.selected]} 선택 중 · 배치 전에는 바꿀 수 있어요.`}</p></section>` : ''}${breakdown()}<details class="dice-breakdown"><summary>보너스 조건</summary><p>가로줄 합 10~14: +10점</p><p>세로줄 세 숫자 모두 다름: +8점</p><p>대각선 세 숫자 모두 홀수/짝수: +6점</p></details></div></div>`;
  }
  function render() { $('#play').innerHTML = game === 'code' ? codeView() : game === 'reverse' ? reverseView() : diceView(); }
  function openRecords() {
    const read = store.records(); $('#records-warning').textContent = read.error;
    $('#record-summary').innerHTML = Object.entries(C.GAMES).map(([id, g]) => {
      const rows = read.rows.filter(r => r.game === id), wins = rows.filter(r => r.outcome === 'won');
      const detail = id === 'code' ? `${wins.length}승 / ${rows.length}경기 · 최고 ${wins.length ? Math.max(...wins.map(r => r.score)) + '점' : '기록 없음'}` : id === 'reverse' ? `${wins.length}회 성공 / ${rows.length}경기 · 최소 ${wins.length ? Math.min(...wins.map(r => r.moves)) + '회' : '기록 없음'}` : `${rows.length}회 완료 · 최고 ${rows.length ? Math.max(...rows.map(r => r.score)) + '점' : '기록 없음'}`;
      return `<section class="record-summary"><h3>${g.name}</h3><p>${detail}</p></section>`;
    }).join('');
    $('#record-list').innerHTML = read.rows.length ? read.rows.slice(0, 20).map(r => `<div class="suite-record"><b>${C.GAMES[r.game].name}</b> · ${r.outcome === 'won' ? '성공' : r.outcome === 'lost' ? '실패' : '완료'} · ${r.game === 'reverse' ? `${r.moves}회 / 별 ${r.stars}` : `${r.score}점${r.game === 'code' ? ` / ${r.attempts}회` : ''}`}<small>${escape(new Date(r.finishedAt).toLocaleString('ko-KR'))} · 경과 ${Math.floor(r.elapsedMs / 60000)}분 ${Math.floor(r.elapsedMs / 1000) % 60}초</small></div>`).join('') : '<p class="note">아직 완료한 도전이 없습니다.</p>';
    if (!$('#solo-records').open) $('#solo-records').showModal();
  }
  function requestNew() { if (state.status === 'playing') $('#solo-confirm').showModal(); else newState(); }
  $('#play').addEventListener('submit', event => { if (event.target.id !== 'code-form') return; event.preventDefault(); draft = $('#code-guess').value; execute({ type: 'guess', value: draft }, '#code-guess'); });
  $('#play').addEventListener('input', event => { if (event.target.id === 'code-guess') draft = event.target.value; });
  $('#play').addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-press')) execute({ type: 'press', index: Number(b.dataset.press) }, `[data-press="${b.dataset.press}"]`);
    else if (b.hasAttribute('data-select')) execute({ type: 'select', index: Number(b.dataset.select) }, `[data-select="${b.dataset.select}"]`);
    else if (b.hasAttribute('data-place')) execute({ type: 'place', index: Number(b.dataset.place) }, '[data-select="0"]');
    else if (b.hasAttribute('data-digit')) { const input = $('#code-guess'); if (input.value.length < 4) input.value += b.dataset.digit; draft = input.value; input.focus(); }
    else if (b.hasAttribute('data-new')) newState();
    else if (b.hasAttribute('data-records')) openRecords();
  });
  $('#play').addEventListener('keydown', event => {
    const b = event.target.closest('[data-press],[data-place]'); if (!b) return;
    const size = b.hasAttribute('data-press') ? 4 : 3, index = Number(b.dataset.press ?? b.dataset.place), field = size === 4 ? 'press' : 'place';
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size };
    if (!Object.hasOwn(offsets, event.key)) return; event.preventDefault();
    let next = index + offsets[event.key];
    if (next < 0 || next >= size * size || (['ArrowLeft', 'ArrowRight'].includes(event.key) && Math.floor(next / size) !== Math.floor(index / size))) return;
    const target = $(`[data-${field}="${next}"]`); if (target && !target.disabled) target.focus();
  });
  $('#open-rules').addEventListener('click', () => $('#solo-rules').showModal());
  $('#open-records').addEventListener('click', openRecords);
  $('#new-game').addEventListener('click', requestNew);
  $('#cancel-new').addEventListener('click', () => $('#solo-confirm').close());
  $('#confirm-new').addEventListener('click', () => { $('#solo-confirm').close(); newState(); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).close()));
  window.addEventListener('storage', event => {
    if (event.key === store.sessionKey(game)) {
      const read = store.load(game); if (read.error) { warn(read.error); return; }
      if (read.state) { state = read.state; draft = ''; render(); $('#move-message').textContent = '다른 탭의 최신 진행을 반영했습니다.'; }
    }
    if (event.key === store.historyKey && $('#solo-records').open) openRecords();
  });
  document.title = `${C.GAMES[game].name} | 판루딕`; document.body.dataset.game = game;
  $('#game-title').textContent = C.GAMES[game].name; $('#game-tag').textContent = 'PANLUDIQ · SOLO'; $('#game-description').textContent = descriptions[game];
  document.querySelector(`[data-game-link="${game}"]`).setAttribute('aria-current', 'page');
  $('#rules-heading').textContent = `${C.GAMES[game].name} · 방법 보기`; $('#rules-list').innerHTML = rules[game].map(text => `<li>${text}</li>`).join('');
  const read = store.load(game); warn(read.error);
  if (read.state) { state = read.state; save(); render(); $('#move-message').textContent = '저장된 진행을 불러왔습니다. 새 문제나 주사위를 다시 뽑지 않았습니다.'; }
  else newState();
  if (requested && !Object.hasOwn(C.GAMES, requested)) $('#move-message').textContent = '요청한 게임을 찾지 못해 코드 브레이커를 열었습니다.';
  if (params.get('records') === '1') {
    if ($('#guest-dialog')?.open) $('#guest-dialog').addEventListener('close', openRecords, { once: true }); else openRecords();
  }
})();
