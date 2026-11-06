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
  const api = { lessons, feedback, previewDice };
  if (typeof module !== 'undefined') module.exports = api;
  root.LearningCore = api;
})(typeof window === 'undefined' ? globalThis : window);
