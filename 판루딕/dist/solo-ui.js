(function () {
  'use strict';
  const C = SoloCore, $ = selector => document.querySelector(selector), params = new URLSearchParams(location.search);
  const requested = params.get('game'), game = requested === 'lights' ? 'reverse' : Object.hasOwn(C.GAMES, requested) ? requested : 'code';
  const escape = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let storage;
  try { storage = localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
  const store = SoloStore.create(storage);
  const rules = {
    code: ['0~7 중 서로 다른 숫자 네 개로 만든 암호를 맞힙니다. 첫 자리 0도 가능합니다.', '위치까지 일치한 개수와 숫자만 포함된 개수를 알려줍니다. 어떤 숫자가 맞았는지는 알려주지 않습니다.', '유효한 제출은 최대 8회입니다. 잘못된 입력과 이미 제출한 숫자는 횟수를 쓰지 않습니다.', '8번째 제출도 정답이면 성공입니다. 첫 시도 1,000점에서 추가 시도마다 100점이 줄고 실패는 0점입니다.', '새로고침해도 암호와 시도 기록은 유지됩니다. 힌트와 시간 제한은 없습니다.'],
    reverse: ['한 칸을 누르면 그 칸과 상하좌우의 불빛이 반전됩니다. 대각선과 보드 바깥은 영향을 받지 않습니다.', '불빛 16개를 모두 끄면 성공입니다. 자유 모드는 조작 횟수 제한이 없습니다.', '25회 도전은 쉬움·보통·어려움을 고릅니다. 실제 최소 풀이가 각각 2~3회·4~5회·6~7회인 문제를 제공합니다. 사람의 체감 난이도와는 다를 수 있습니다.', '도전 모드의 제한은 난이도와 관계없이 25회입니다. 25번째 조작으로 완성해도 성공입니다.', '도전 성공 시 10회 이내 별 3개, 16회 이내 별 2개, 25회 이내 별 1개입니다. 자유 모드에는 별을 부여하지 않습니다.', '모드·난이도를 바꾸면 새 문제로 시작합니다. 조작한 진행은 확인 후 교체합니다. 새로고침은 같은 진행을 불러옵니다.', '이전 불빛 뒤집기·리버스 타일 기록은 그대로 보존하고 새 모드·난이도 기록과 구분합니다. 힌트·되돌리기는 없습니다.'],
    dice: ['매 턴 주사위 두 개 중 하나를 고른 뒤 빈칸에 배치합니다. 같은 눈 두 개가 나올 수도 있습니다.', '배치 전에는 선택을 바꿀 수 있습니다. 놓은 주사위는 이동하거나 취소할 수 없습니다. 9칸을 채우면 완료됩니다.', '모든 눈의 합이 기본점수입니다. 완성된 가로줄 합이 10~14이면 줄마다 +10점입니다.', '완성된 세로줄의 세 숫자가 모두 다르면 줄마다 +8점입니다.', '두 대각선은 각각 세 숫자가 모두 홀수이거나 모두 짝수이면 +6점입니다.', '빈칸이 남은 줄에는 보너스가 없습니다. 화면 점수는 현재 배치 기준이며, 최종 등급은 아직 부여하지 않습니다.']
  };
  const descriptions = { code: '숫자 네 개, 여덟 번의 기회. 단서로 암호를 좁혀보세요.', reverse: '불빛을 모두 끄세요. 자유롭게 풀거나, 난이도를 골라 25회에 도전하세요.', dice: '두 눈 중 하나를 고르고, 아홉 칸의 조합을 완성하세요.' };
  let state, draft = '', pendingSettings = null;
  function warn(message) { if (message) { $('#save-warning').hidden = false; $('#save-warning').textContent = message; } }
  function save() {
    const saved = store.save(state);
    $('#save-status').textContent = saved.ok ? (state.status === 'playing' ? '이 브라우저에 진행을 저장했습니다.' : '완료 기록을 이 브라우저에 저장했습니다.') : '저장하지 못함 · 현재 페이지에서 플레이 가능';
    if (!saved.ok) warn(saved.error);
  }
  function focus(selector) { if (!document.querySelector('dialog[open]')) $(selector)?.focus({ preventScroll: true }); }
  function newState(settings = {}) {
    const value = new Uint32Array(1); let seed = Date.now();
    if (globalThis.crypto?.getRandomValues) { crypto.getRandomValues(value); seed = value[0]; }
    const previous = game === 'reverse' && state ? C.reverseSettings(state) : { mode: 'free', difficulty: 'easy' };
    const lightOptions = game === 'reverse' ? { mode: settings.mode ?? previous.mode, difficulty: settings.difficulty ?? (previous.difficulty === 'legacy' || previous.difficulty === null ? 'easy' : previous.difficulty) } : {};
    state = C.create(game, { seed, ...lightOptions }); pendingSettings = null; draft = ''; save(); render();
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
      $('#move-message').textContent = game === 'code' ? `위치 일치 ${state.data.attempts.at(-1).exact}개 · 숫자만 일치 ${state.data.attempts.at(-1).misplaced}개. ${8 - state.data.attempts.length}회 남았습니다.` : game === 'reverse' ? `${state.data.moves}회 조작 · 꺼진 불 ${brightCount()}/16` : action.type === 'select' ? `${state.data.pair[state.data.selected]}을 선택했습니다. 빈칸에 놓으세요.` : `${state.data.turns}/9칸 배치 · 현재 ${r.score}점. 다음 주사위를 선택하세요.`;
      Sound.play('select'); if (focusSelector) focus(focusSelector);
    }
  }
  function brightCount() { let x = state.data.board, n = 0; while (x) { x &= x - 1; n++; } return n; }
  function banner() {
    const r = C.result(state); if (!r.terminal) return '';
    const success = state.status !== 'lost';
    const heading = game === 'dice' ? '아홉 칸을 완성했어요!' : success ? (game === 'code' ? '암호를 찾았어요!' : '모든 불을 껐어요!') : (game === 'code' ? '여덟 번의 도전이 끝났어요.' : '25회 조작이 끝났어요.');
    const value = game === 'code' ? `${r.score}점` : game === 'reverse' ? (success ? `${r.stars ? '★'.repeat(r.stars) + ' · ' : ''}${r.moves}회` : `${r.moves}회 · 미완성`) : `${r.score}점`;
    return `<div class="result-band ${success ? '' : 'failed'}"><h2 id="phase-heading" tabindex="-1">${heading}</h2><p class="result-value">${value}</p>${game === 'code' ? `<p>정답 <strong class="result-answer">${state.data.secret}</strong></p>` : ''}<div class="result-actions"><button class="primary" data-new>새 도전</button><button data-records>내 기록</button><a class="button" href="index.html#games">게임 목록</a></div></div>`;
  }
  function codeView() {
    const d = state.data, playing = state.status === 'playing';
    return `${banner()}<div class="play-status"><span>도전 <strong>${d.attempts.length}<small> / 8</small></strong></span><span>0~7 · 중복 없는 4자리</span></div>${playing ? '<h2 id="phase-heading" tabindex="-1" class="visually-hidden">암호 추리</h2>' : ''}<p class="short-rule">위치까지 일치한 개수와 숫자만 일치한 개수를 확인하세요.</p><div class="code-secret" aria-label="${playing ? '비밀 암호 네 자리' : '정답 암호'}">${Array.from({ length: 4 }, (_, i) => `<span>${playing ? '?' : d.secret[i]}</span>`).join('')}</div>${playing ? `<form id="code-form" class="code-entry" novalidate><label for="code-guess">추리한 숫자 네 자리</label><div class="code-entry-line"><input id="code-guess" type="text" inputmode="numeric" maxlength="4" autocomplete="off" spellcheck="false" aria-describedby="move-message" value="${escape(draft)}" placeholder="예: 0367"><button class="primary" type="submit">확인 →</button></div><div class="digit-pad" aria-label="숫자 입력">${Array.from({ length: 8 }, (_, i) => `<button type="button" data-digit="${i}" aria-label="숫자 ${i} 입력">${i}</button>`).join('')}</div></form>` : ''}<ol class="attempts" aria-label="이전 추리 기록">${d.attempts.map((a, i) => `<li><span class="attempt-number">${i + 1}회</span><strong class="guess">${a.guess}</strong><span class="hint">위치 <b>${a.exact}</b> · 숫자만 ${a.misplaced}</span></li>`).join('')}</ol>`;
  }
  function lightLabel(row) {
    if (row.ruleVersion === C.VERSION) return '이전 리버스 타일 · 25회(난이도 미분류)';
    return row.mode === 'free' ? '자유 모드' : `25회 도전 · ${C.LEVELS[row.difficulty].name}`;
  }
  function reverseView() {
    const d = state.data, playing = state.status === 'playing', settings = C.reverseSettings(state);
    const level = settings.difficulty, mode = settings.mode;
    return `<div class="light-settings"><label for="lights-mode">모드<select id="lights-mode"><option value="free" ${mode === 'free' ? 'selected' : ''}>자유 모드 · 횟수 제한 없음</option><option value="challenge" ${mode === 'challenge' ? 'selected' : ''}>25회 도전</option></select></label><label for="lights-level">도전 난이도<select id="lights-level" ${mode === 'free' ? 'disabled' : ''}>${level === 'legacy' ? '<option value="legacy" selected disabled>이전 문제 · 난이도 미분류</option>' : ''}${Object.entries(C.LEVELS).map(([id, l]) => `<option value="${id}" ${level === id ? 'selected' : ''}>${l.name} · 최소 풀이 ${l.min}~${l.max}회</option>`).join('')}</select></label></div><p class="mode-note">${mode === 'free' ? '횟수 제한 없이 모든 불을 꺼보세요.' : level === 'legacy' ? '이전 리버스 타일의 진행을 그대로 이어갑니다. 새 난이도 기록과 구분합니다.' : `${C.LEVELS[level].name} · 실제 최소 풀이 ${C.LEVELS[level].min}~${C.LEVELS[level].max}회인 문제 · 제한 25회`}</p>${banner()}${playing ? '<h2 id="phase-heading" tabindex="-1" class="visually-hidden">불빛 뒤집기</h2>' : ''}<div class="play-status"><span>조작 <strong>${d.moves}<small>${settings.limit ? ' / 25' : '회 · 제한 없음'}</small></strong></span><span>꺼진 불 <strong>${brightCount()}<small> / 16</small></strong></span></div><p class="short-rule">한 칸과 상하좌우를 뒤집습니다. 모두 끄면 성공!</p><div class="reverse-board" role="group" aria-label="4행 4열 불빛 퍼즐">${Array.from({ length: 16 }, (_, i) => { const on = !(d.board & 1 << i); return `<button class="reverse-tile ${on ? 'is-light' : ''}" data-press="${i}" aria-pressed="${on}" aria-label="${Math.floor(i / 4) + 1}행 ${i % 4 + 1}열 ${on ? '켜짐' : '꺼짐'}, 누르면 상하좌우 반전" ${playing ? '' : 'disabled'}><span aria-hidden="true">${on ? '○' : '●'}</span></button>`; }).join('')}</div><div class="reverse-legend"><span><i></i>목표: 모두 꺼짐</span><span><i class="bright"></i>켜진 불</span></div>${settings.limit ? '<p class="reverse-limit">10회 ★★★ · 16회 ★★ · 25회 ★</p>' : ''}`;
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
    const read = store.records(), legacy = store.legacyLights(); $('#records-warning').textContent = [read.error, legacy.error].filter(Boolean).join(' ');
    $('#record-summary').innerHTML = Object.entries(C.GAMES).map(([id, g]) => {
      const rows = read.rows.filter(r => r.game === id), wins = rows.filter(r => r.outcome === 'won');
      let detail;
      if (id === 'reverse') {
        const groups = [['free', '자유 모드'], ...Object.entries(C.LEVELS).map(([key, l]) => [key, `25회 도전 · ${l.name}`]), ['legacy', '이전 리버스 타일 · 난이도 미분류']];
        detail = groups.map(([key, name]) => {
          const matches = rows.filter(r => key === 'legacy' ? r.ruleVersion === C.VERSION : r.ruleVersion !== C.VERSION && (key === 'free' ? r.mode === 'free' : r.mode === 'challenge' && r.difficulty === key));
          const successes = matches.filter(r => r.outcome === 'won');
          return `<p>${name} · ${successes.length}회 성공 / ${matches.length}경기 · 최소 ${successes.length ? Math.min(...successes.map(r => r.moves)) + '회' : '기록 없음'}</p>`;
        }).join('');
        detail += `<p>이전 불빛 뒤집기 · 자유 모드 ${legacy.rows.length}회 성공 · 최소 ${legacy.rows.length ? Math.min(...legacy.rows.map(r => r.moves)) + '회' : '기록 없음'}</p>`;
      } else detail = `<p>${id === 'code' ? `${wins.length}승 / ${rows.length}경기 · 최고 ${wins.length ? Math.max(...wins.map(r => r.score)) + '점' : '기록 없음'}` : `${rows.length}회 완료 · 최고 ${rows.length ? Math.max(...rows.map(r => r.score)) + '점' : '기록 없음'}`}</p>`;
      return `<section class="record-summary"><h3>${g.name}</h3>${detail}</section>`;
    }).join('');
    const currentRows = read.rows.slice(0, 20).map(r => `<div class="suite-record"><b>${C.GAMES[r.game].name}</b> · ${r.outcome === 'won' ? '성공' : r.outcome === 'lost' ? '실패' : '완료'} · ${r.game === 'reverse' ? `${lightLabel(r)} · ${r.moves}회${r.stars ? ' / 별 ' + r.stars : ''}` : `${r.score}점${r.game === 'code' ? ` / ${r.attempts}회` : ''}`}<small>${escape(new Date(r.finishedAt).toLocaleString('ko-KR'))} · 경과 ${Math.floor(r.elapsedMs / 60000)}분 ${Math.floor(r.elapsedMs / 1000) % 60}초</small></div>`).join('');
    const oldRows = legacy.rows.slice(0, 10).map(r => `<div class="legacy-light-record"><b>불빛 뒤집기 · 이전 자유 모드</b> · 성공 · ${r.moves}회<small>${escape(new Date(r.time).toLocaleString('ko-KR'))}</small></div>`).join('');
    $('#record-list').innerHTML = (currentRows || '<p class="note">아직 새 모드에서 완료한 도전이 없습니다.</p>') + (oldRows ? '<h3>보존된 이전 자유 모드 기록</h3>' + oldRows : '');
    if (!$('#solo-records').open) $('#solo-records').showModal();
  }
  function requestNew() { pendingSettings = null; if (state.status === 'playing') $('#solo-confirm').showModal(); else newState(); }
  $('#play').addEventListener('change', event => {
    if (!['lights-mode', 'lights-level'].includes(event.target.id)) return;
    const options = { mode: $('#lights-mode').value, difficulty: Object.hasOwn(C.LEVELS, $('#lights-level').value) ? $('#lights-level').value : 'easy' };
    if (state.status === 'playing' && state.data.moves > 0) { pendingSettings = options; $('#solo-confirm').showModal(); }
    else newState(options);
  });
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
  $('#cancel-new').addEventListener('click', () => { pendingSettings = null; $('#solo-confirm').close(); render(); });
  $('#solo-confirm').addEventListener('cancel', () => { pendingSettings = null; render(); });
  $('#confirm-new').addEventListener('click', () => { const options = pendingSettings || {}; $('#solo-confirm').close(); newState(options); });
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
  if (game === 'reverse') { const url = new URL(location.href); url.searchParams.set('game', 'lights'); history.replaceState(null, '', url); }
  const read = store.load(game); warn(read.error);
  if (read.state) { state = read.state; save(); render(); $('#move-message').textContent = '저장된 진행을 불러왔습니다. 새 문제나 주사위를 다시 뽑지 않았습니다.'; }
  else newState();
  if (requested && requested !== 'lights' && !Object.hasOwn(C.GAMES, requested)) $('#move-message').textContent = '요청한 게임을 찾지 못해 코드 브레이커를 열었습니다.';
  if (params.get('records') === '1') {
    if ($('#guest-dialog')?.open) $('#guest-dialog').addEventListener('close', openRecords, { once: true }); else openRecords();
  }
})();
