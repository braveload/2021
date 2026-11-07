const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const origin = 'https://panludiq.onrender.com';
const website = { '@type': 'WebSite', '@id': origin + '/#website', url: origin + '/', name: '판루딕', alternateName: 'PANLUDIQ', inLanguage: 'ko' };
const games = [
  ['lights.html', '불빛 뒤집기', '그림 연습에서 함께 바뀌는 칸을 확인하고, 누른 칸과 상하좌우의 불빛을 뒤집어 16칸을 모두 끕니다. 기록과 분리된 연습, 자유 모드, 난이도별 25회 도전을 제공합니다.', 'assets/lights-v2.svg', 'SinglePlayer', 1],
  [null, '숫자야구', '중복 없는 0~9 숫자를 3자리 또는 4자리로 추리합니다. 스트라이크와 볼을 단서로 시간제한 없이 10회 도전합니다.', 'assets/baseball-v2.svg', 'SinglePlayer', 1, 'baseball'],
  [null, '트리플 코드', '시간제한 없는 그림 연습으로 모양·개수·무늬 조건을 익힌 뒤, 9장의 카드 중 조건에 맞는 3장을 고릅니다. 실제 도전은 6라운드이며 라운드당 제한시간은 40초입니다.', null, 'SinglePlayer', 1, 'triple'],
  [null, '기억의 짝', '카드 16장을 뒤집어 같은 그림 8쌍을 찾는 기억 게임입니다. 제한시간은 120초입니다.', null, 'SinglePlayer', 1, 'memory'],
  ['code-breaker.html', '코드 브레이커', '그림 연습에서 공개된 연습 정답과 입력을 비교하고, 본게임에서 0~7 중 서로 다른 숫자 4개의 암호를 위치 일치와 숫자 포함 단서로 추리합니다. 기록과 분리된 연습은 시간·횟수 제한이 없으며 본게임은 시간제한 없이 최대 8회 도전합니다.', 'assets/solo-code.svg', 'SinglePlayer', 1],
  ['dice-strategy.html', '전략 주사위', '기록과 분리된 시간·횟수 제한 없는 그림 연습에서 배치와 기본점수·가로·세로·대각선 보너스를 배웁니다. 본게임은 매 턴 주사위 두 개 중 하나를 고르고 예상 점수를 확인해 3×3 보드에 배치를 확정하며, 9칸의 눈의 합과 보너스로 최종 점수를 계산합니다.', 'assets/solo-dice.svg', 'SinglePlayer', 1],
  ['number-chain.html', '숫자 연쇄', '시간·횟수 제한 없는 그림 연습에서 같은 색·숫자 차이 1·양 끝 선택·재추첨을 배웁니다. 연습은 기록과 분리됩니다. 본게임은 카드를 양 끝에 총 12회 배치하며 막혔을 때 최대 2회 재추첨할 수 있습니다.', 'assets/solo-chain.svg', 'SinglePlayer', 1],
  ['line-control.html', '라인 컨트롤', '기록과 분리된 시간·횟수 제한 없는 그림 연습에서 연결·겹침·교차 득점과 종료 시 중앙 보너스를 배웁니다. 본게임은 5×5 보드에서 AI와 각 10번 놓으며, 연속 3칸당 3점과 경기 종료 시 중앙 3×3 영역 보너스를 겨룹니다. 연결선과 득점 이유를 표시하고 AI 난이도·선후공을 선택할 수 있습니다.', 'assets/solo-line.svg', 'SinglePlayer', 1],
  ['chess.html', '12칸 미니 체스', '대전과 분리된 시간·횟수 제한 없는 그림 연습에서 말 이동·잡기·재투입·폰 승급과 승리 조건을 배웁니다. 본게임은 3열 4행 로컬 2인 게임이며, 상대 킹 포획 또는 끝줄에 진입한 킹의 상대 한 차례 생존으로 승리합니다.', null, 'MultiPlayer', 2],
  ['online.html', '12칸 미니 체스 온라인 친구 대전', '방을 만들고 초대 링크나 6자리 코드로 친구와 각자의 기기에서 대결하는 12칸 미니 체스입니다. 대전과 분리된 시간·횟수 제한 없는 그림 연습에서 이동·잡기·재투입·승리 조건을 배울 수 있습니다. 방과 경기 기록은 서버 재시작·배포 시 초기화됩니다.', null, 'MultiPlayer', 2]
];
function entity(g) {
  const [file, name, description, image, mode, players, popup] = g;
  const url = file ? origin + '/' + file : origin + '/#games';
  return { '@type': 'VideoGame', '@id': file ? url + '#game' : origin + '/#game-' + popup,
    name, url, description, inLanguage: 'ko', isAccessibleForFree: true,
    applicationCategory: 'GameApplication', gamePlatform: '웹 브라우저',
    playMode: 'https://schema.org/' + mode,
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: players, maxValue: players },
    ...(image ? { image: origin + '/' + image } : {}) };
}
function generate() {
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    let html = fs.readFileSync(path.join(root, file), 'utf8');
    html = html.replace(/<nav class="page-breadcrumb"[\s\S]*?<\/nav>/g, '')
      .replace(/<script id="page-schema" type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
      .replace(/<link rel="canonical"[^>]*>\s*/g, '')
      .replace(/<meta name="robots" content="noindex,follow">\s*/g, '');
    if (file === 'solo.html') {
      html = html.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
    } else {
      const home = file === 'index.html', url = origin + (home ? '/' : '/' + file);
      const g = games.find(g => g[0] === file), game = g && entity(g);
      if (!home && !game) throw new Error('Missing page mapping: ' + file);
      const page = { '@type': home ? 'CollectionPage' : 'WebPage', '@id': url + '#webpage', url,
        name: home ? '판루딕 | 생각하는 즐거움' : g[1] + ' | 판루딕', inLanguage: 'ko',
        description: home ? '두뇌게임 8종과 12칸 미니 체스 로컬·온라인 친구 대전을 제공하는 판루딕입니다.' : g[2],
        isPartOf: { '@id': website['@id'] }, mainEntity: { '@id': home ? origin + '/#games-list' : game['@id'] } };
      const graph = [website, page];
      if (home) {
        const entries = games.slice(0, 9).map(entity);
        graph.push({ '@type': 'ItemList', '@id': origin + '/#games-list', name: '판루딕 게임 목록', numberOfItems: entries.length,
          itemListElement: entries.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@id': item['@id'] } })) }, ...entries);
      } else {
        const breadcrumb = { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
          { '@type': 'ListItem', position: 1, name: '판루딕', item: origin + '/' },
          { '@type': 'ListItem', position: 2, name: g[1], item: url }
        ] };
        page.breadcrumb = { '@id': breadcrumb['@id'] };
        graph.push(game, breadcrumb);
        const nav = '<nav class="page-breadcrumb" aria-label="탐색경로"><ol><li><a href="' + origin + '/">판루딕</a></li><li aria-current="page">' + g[1] + '</li></ol></nav>';
        html = html.replace(/(<main\b[^>]*>)/, '$1' + nav);
      }
      html = html.replace(/<meta name="description"[^>]*>\s*/g, '');
      const head = '<link rel="canonical" href="' + url + '"><meta name="description" content="' + page.description + '">\n<script id="page-schema" type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') + '</script>\n';
      html = html.replace('</head>', head + '</head>');
    }
    fs.writeFileSync(path.join(root, file), html);
  }
}
if (require.main === module) generate();
module.exports = { games, entity, generate, origin };
