(function(root){
  'use strict';
  const lessons=[
    {title:'킹 · 여덟 방향으로 한 칸',pieces:[[10,0,'K'],[0,1,'K']],action:{from:10,to:6},text:'블루 킹을 누르고 표시된 칸을 눌러보세요. 대각선을 포함해 주변 여덟 방향으로 한 칸 이동합니다.'},
    {title:'룩 · 상하좌우로 한 칸',pieces:[[10,0,'K'],[0,1,'K'],[7,0,'R']],action:{from:7,to:4},text:'룩은 멀리 달리지 않아요. 상하좌우로 딱 한 칸입니다.'},
    {title:'비숍 · 대각선으로 한 칸',pieces:[[10,0,'K'],[0,1,'K'],[7,0,'B']],action:{from:7,to:3},text:'비숍을 골라 왼쪽 위 대각선으로 한 칸 옮겨보세요.'},
    {title:'폰 · 앞으로 한 칸',pieces:[[10,0,'K'],[0,1,'K'],[7,0,'P']],action:{from:7,to:4},text:'블루의 앞은 위쪽 ↑입니다. 폰은 이동과 잡기 모두 앞으로 한 칸이에요. 퍼플의 앞은 아래쪽 ↓입니다.'},
    {title:'잡기 · 상대 말이 있는 칸으로',pieces:[[10,0,'K'],[0,1,'K'],[7,0,'R'],[4,1,'B']],action:{from:7,to:4},text:'룩으로 바로 앞의 퍼플 비숍을 잡아보세요. 잡은 비숍이 블루의 보유 말로 바뀝니다.'},
    {title:'재투입 · 보유 말을 빈칸으로',pieces:[[10,0,'K'],[0,1,'K'],[7,0,'R'],[4,1,'B']],setup:[{from:7,to:4},{from:0,to:3}],action:{drop:'B',to:8},text:'앞 단계에서 잡은 뒤 상대가 한 수 응답한 예시예요. 블루 보유 비숍을 누르고 빈칸에 놓아보세요. 이동과 재투입 중 하나가 한 차례입니다.'},
    {title:'폰 승급 · 이동으로 상대 끝줄 도착',pieces:[[10,0,'K'],[11,1,'K'],[4,0,'P']],action:{from:4,to:1},text:'폰을 위쪽 끝줄로 이동하면 자동 승급해요. 승급 폰은 뒤쪽 대각선을 뺀 여섯 방향으로 한 칸 움직입니다. 끝줄에 재투입한 폰은 승급하지 않아요.'},
    {title:'승리 ① · 상대 킹을 실제로 잡기',pieces:[[10,0,'K'],[1,1,'K'],[4,0,'R']],action:{from:4,to:1},text:'룩으로 퍼플 킹을 잡아보세요. 체크메이트 판정 없이 킹을 실제로 잡는 즉시 승리합니다.'},
    {title:'승리 ② · 끝줄 진입 후 상대 한 차례 생존',pieces:[[4,0,'K'],[11,1,'K'],[9,1,'R']],action:{from:4,to:1},reply:{from:9,to:6},text:'내 킹을 상대 끝줄로 옮겨보세요. 진입만으로는 승리가 아니에요. 상대의 한 차례가 끝나도 킹이 살아 있으면 승리합니다.'},
    {title:'주의 · 진입한 킹도 잡히면 패배',pieces:[[4,0,'K'],[11,1,'K'],[2,1,'R']],action:{from:4,to:1},reply:{from:2,to:1},text:'위험한 칸으로 킹을 옮기는 것도 허용돼요. 하지만 끝줄에 들어가도 상대가 킹을 잡으면 포획 승리가 먼저입니다.'}
  ];
  function create(index,M){const p=lessons[index],s=M.create();s.board=Array(12).fill(null);p.pieces.forEach(([i,player,t])=>s.board[i]={p:player,t});s.hands=[[],[]];s.turn=0;s.ply=0;s.pending=null;s.result=null;s.seen={[M.key(s)]:1};return (p.setup||[]).reduce((state,a)=>M.apply(state,a).state,s);}
  const api={lessons,create};if(typeof module!=='undefined')module.exports=api;root.MiniLessons=api;
})(typeof window==='undefined'?globalThis:window);
