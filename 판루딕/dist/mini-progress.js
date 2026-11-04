/* Replay the local game to restore legal board, hands and repetition history. */
(() => {
  'use strict';
  const KEY = 'panludiq.mini.session.v1', originalRender = render;
  let restored = false, failed = false;
  const eventText = e => `${color(e.p)} · ${names[e.moved]} ${e.drop ? '보유 말 → ' : pos(e.from) + ' → '}${pos(e.to)}${e.captured ? ' · ' + names[e.captured] + ' 포획' : ''}${e.promoted ? ' · 승급' : ''}`;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const x = JSON.parse(raw);
        if (x.schema !== 1 || typeof x.flipped !== 'boolean' || typeof x.blueFirst !== 'boolean' || typeof x.resigned !== 'boolean' || !Array.isArray(x.actions) || x.actions.length > 100) throw Error('invalid');
        let replay = M.create(); const events = [];
        for (const action of x.actions) {
          const legal = M.actions(replay).find(a => a.to === action.to && (a.drop ? a.drop === action.drop : a.from === action.from && !action.drop));
          if (!legal) throw Error('illegal saved move'); const out = M.apply(replay, legal); replay = out.state; events.push(out.event);
        }
        if (x.resigned) { if (replay.result) throw Error('invalid resignation'); replay.result = { winner: 1 - replay.turn, reason: (replay.turn === 0 ? (x.blueFirst ? '블루' : '퍼플') : (x.blueFirst ? '퍼플' : '블루')) + ' 기권' }; }
        game = replay; flipped = x.flipped; blueFirst = x.blueFirst; miniMoves = x.actions; logs = events.map(eventText); selected = null; restored = true;
      } catch { if (!localStorage.getItem(KEY + '.backup')) localStorage.setItem(KEY + '.backup', raw); }
    }
  } catch { failed = true; }
  render = function () {
    originalRender();
    try { localStorage.setItem(KEY, JSON.stringify({ schema: 1, actions: miniMoves, flipped, blueFirst, resigned: !!game.result?.reason.endsWith('기권') })); } catch { failed = true; }
    let note = document.getElementById('mini-save-status');
    if (!note) { note = document.createElement('p'); note.id = 'mini-save-status'; note.className = 'note'; note.setAttribute('role', 'status'); document.querySelector('.controls').after(note); }
    note.textContent = failed ? '진행을 저장하지 못했습니다. 현재 페이지에서는 계속할 수 있습니다.' : restored ? '저장된 경기·차례·보유 말을 복구했습니다. 진행은 자동 저장됩니다.' : '경기·차례·보유 말 자동 저장 · 새로고침해도 이어집니다.';
  };
  render();
})();
