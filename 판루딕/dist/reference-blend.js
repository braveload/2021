// Presentation-only copy; original launch handlers and game state are untouched.
(() => {
  const descriptions = {
    '숫자야구': '숫자와 자리, 단서를 좁혀가요.',
    '기억의 짝': '뒤집고, 기억하고, 짝을 찾아요.',
    '불빛 뒤집기': '불을 모두 끄면 성공이에요.',
    '트리플 코드': '조건에 맞는 세 장을 찾아요.',
    '코드 브레이커': '단서를 모아 암호를 풀어요.',
    '전략 주사위': '주사위를 놓고 점수를 만들어요.',
    '숫자 연쇄': '색이나 숫자를 이어 붙여요.',
    '라인 컨트롤': '세 칸을 잇고, 중앙을 노려요.'
  };
  document.querySelectorAll('.game-card').forEach(card => {
    const title = card.querySelector('.game-name');
    const description = descriptions[title?.textContent.trim()];
    if (!description || card.querySelector('.game-intro')) return;
    const line = document.createElement('span');
    line.className = 'game-intro';
    line.textContent = description;
    title.after(line);
  });
})();
