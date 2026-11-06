(function (root) {
  'use strict';
  const lessons = [
    { cards:[[1,2,1],[2,2,2],[1,2,0],[1,2,2],[2,0,2],[2,1,1],[0,2,0],[2,1,0],[0,1,0]], target:[true,true,false], answer:[0,2,3] },
    { cards:[[2,1,2],[0,2,0],[2,1,0],[2,2,1],[2,0,0],[1,2,2],[1,1,1],[0,2,1],[0,0,2]], target:[false,false,true], answer:[0,5,8] },
    { cards:[[1,1,2],[1,0,0],[2,1,1],[2,1,0],[2,2,0],[0,2,1],[1,2,2],[1,1,0],[2,0,2]], target:[false,true,false], answer:[4,5,6] }
  ];
  function feedback(cards, selection, target) {
    if (selection.length !== 3 || new Set(selection).size !== 3 || selection.some(i => !Number.isInteger(i) || !cards[i])) return null;
    return target.map((same, axis) => {
      const values = selection.map(i => cards[i][axis]), count = new Set(values).size;
      return { axis, same, values, ok: same ? count === 1 : count === 3 };
    });
  }
  function previewDice(board, value, index, score) {
    if (!Array.isArray(board) || board.length !== 9 || board.some(n => n !== null && (!Number.isInteger(n) || n < 1 || n > 6)) || !Number.isInteger(value) || value < 1 || value > 6 || !Number.isInteger(index) || index < 0 || index > 8 || board[index] !== null) return null;
    const copy = board.slice(); copy[index] = value;
    const before = score(board), after = score(copy), gains = [];
    for (const [key, label] of [['rows','가로'],['columns','세로'],['diagonals','대각선']]) {
      after[key].forEach((points, i) => { const delta = points - before[key][i]; if (delta) gains.push({ key, line:i, label:label + ' ' + (i + 1), points:delta }); });
    }
    return { index, value, before:before.total, total:after.total, delta:after.total-before.total, base:after.base-before.base, bonus:gains.reduce((n,g)=>n+g.points,0), gains };
  }
  const lightLessons = [
    { title:'가운데 한 칸, 함께 바뀌는 다섯 칸', presses:[5], guide:true },
    { title:'가장자리에는 없는 칸이 있어요', presses:[0], guide:true },
    { title:'두 번 눌러 모든 불 끄기', presses:[6,9], guide:false }
  ];
  function lineFeedback(s, windows) {
    const board=Array(25).fill(0), events=[], seen=[new Set(),new Set()];
    let player=s.data.starter==='ai'?2:1;
    for (const [move, index] of s.data.moves.entries()) {
      board[index]=player;
      const ids=windows.flatMap((w,i)=>w.every(cell=>board[cell]===player)&&!seen[player-1].has(i)?[i]:[]);
      ids.forEach(i=>seen[player-1].add(i));
      if(ids.length)events.push({move:move+1,player,index,lines:ids,points:ids.length*3});
      player=3-player;
    }
    const lines=windows.flatMap((cells,id)=>board[cells[0]]&&cells.every(i=>board[i]===board[cells[0]])?[{id,cells,player:board[cells[0]]}]:[]);
    const center=[1,2].map(p=>board.filter((n,i)=>n===p&&Math.floor(i/5)>=1&&Math.floor(i/5)<=3&&i%5>=1&&i%5<=3).length);
    return {events,lines,center};
  }
  const codeLessons = [
    {title:'같은 자리면 위치 일치',secret:'0246',guess:'0257'},
    {title:'숫자는 있지만 자리가 다르면 숫자만 포함',secret:'0246',guess:'2067'},
    {title:'단서를 보고 직접 암호 맞히기',secret:'0246',guess:null}
  ];
  const chainLessons = [
    {title:'같은 색이면 숫자가 멀어도 연결',chain:[3],offer:[7,17,24],goal:'place',side:'right'},
    {title:'다른 색이라면 숫자 차이 1',chain:[3],offer:[13,17,24],goal:'place',side:'right'},
    {title:'왼쪽과 오른쪽 끝을 따로 살펴보기',chain:[3,4],offer:[10,14,24],goal:'place',side:'right'},
    {title:'양쪽이 막혔을 때만 재추첨',chain:[3],offer:[17,24,28],goal:'redraw',replacement:[13,17,24],side:'right'}
  ];
  function codeComparison(secret,guess){
    return [...guess].map((digit,index)=>({digit,index,kind:digit===secret[index]?'exact':secret.includes(digit)?'misplaced':'absent',target:secret.indexOf(digit)}));
  }
  function chainConnection(id,end,card){const a=card(id),b=card(end),same=a.color===b.color,near=Math.abs(a.number-b.number)===1;return {same,near,ok:same||near,points:same||near?2+(near?1:0):0};}
  const api = { lessons, feedback, previewDice, lightLessons, lineFeedback, codeLessons, chainLessons, codeComparison, chainConnection };
  if (typeof module !== 'undefined') module.exports = api;
  root.LearningCore = api;
})(typeof window === 'undefined' ? globalThis : window);
