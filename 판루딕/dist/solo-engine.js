(function(root){
'use strict';
const colors=[{id:'red',name:'빨강',hex:'#eb647b'},{id:'blue',name:'파랑',hex:'#4e8bf5'},{id:'green',name:'초록',hex:'#37a890'},{id:'yellow',name:'노랑',hex:'#e9b63e'}];
function shuffle(input,rng=Math.random){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function freshChain(rng=Math.random){const deck=shuffle(colors.flatMap(c=>Array.from({length:9},(_,i)=>({id:c.id+(i+1),color:c.id,n:i+1}))),rng);return {id:'chain',chain:[deck.shift()],offer:deck.splice(0,3),deck,turn:0,score:0,rerolls:2,rerolled:0}}
function canLink(a,b){return !!a&&!!b&&(a.color===b.color||Math.abs(a.n-b.n)===1)}
function chainMoves(s){const out=[];for(let i=0;i<s.offer.length;i++){if(canLink(s.offer[i],s.chain[0]))out.push({index:i,side:'left'});if(canLink(s.offer[i],s.chain[s.chain.length-1]))out.push({index:i,side:'right'})}return out}
function chainPlace(s,i,side){if(s.turn>=12||!Number.isInteger(i)||i<0||i>=s.offer.length||!['left','right'].includes(side))throw Error('유효하지 않은 카드 선택');const card=s.offer[i],edge=side==='left'?s.chain[0]:s.chain[s.chain.length-1];if(!canLink(card,edge))throw Error('연결할 수 없는 카드');const offer=s.offer.filter((_,j)=>j!==i),deck=[...s.deck];if(deck.length)offer.push(deck.shift());const chain=side==='left'?[card,...s.chain]:[...s.chain,card];return {...s,chain,offer,deck,turn:s.turn+1,score:s.score+2+(Math.abs(card.n-edge.n)===1?1:0)}}
function chainReroll(s){if(s.rerolls<=0||chainMoves(s).length||s.deck.length===0||s.turn>=12)throw Error('재추첨할 수 없는 상태');const deck=[...s.deck];return {...s,offer:deck.splice(0,3),deck,rerolls:s.rerolls-1,rerolled:s.rerolled+1}}
function chainOver(s){return s.turn>=12||(chainMoves(s).length===0&&(s.rerolls===0||s.deck.length===0))}
function chainStars(score){return score>=32?3:score>=24?2:score>=12?1:0}
const windows=[];for(let y=0;y<5;y++)for(let x=0;x<5;x++)for(const [dy,dx] of [[0,1],[1,0],[1,1],[1,-1]]){const ey=y+dy*2,ex=x+dx*2;if(ey>=0&&ey<5&&ex>=0&&ex<5)windows.push([y*5+x,(y+dy)*5+x+dx,ey*5+ex])}
function lineWindows(board,mark){return windows.filter(w=>w.every(i=>board[i]===mark))}
function lineScore(board,mark){return lineWindows(board,mark).length*3}
function centerScore(board,mark){let total=0;for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)if(board[y*5+x]===mark)total++;return total}
function lineStep(board,index,mark){if(!Array.isArray(board)||board.length!==25||!Number.isInteger(index)||index<0||index>24||board[index]!==0||![1,2].includes(mark))throw Error('유효하지 않은 착수');const result=board.slice();result[index]=mark;return result}
function newLineWindows(oldBoard,newBoard,mark){const before=new Set(lineWindows(oldBoard,mark).map(w=>w.join(',')));return lineWindows(newBoard,mark).filter(w=>!before.has(w.join(',')))}
function lineOver(board){return board.filter(v=>v===1).length>=10&&board.filter(v=>v===2).length>=10}
function lineResult(board){const player=lineScore(board,1)+centerScore(board,1),ai=lineScore(board,2)+centerScore(board,2);return {player,ai,winner:player===ai?0:player>ai?1:2}}
function lineEval(board){let value=(lineScore(board,2)-lineScore(board,1))*1.5+(centerScore(board,2)-centerScore(board,1))*.35;for(const w of windows){let p=0,a=0;for(const i of w){p+=+(board[i]===1);a+=+(board[i]===2)}if(p&&a)continue;if(a)value+=[0,.25,1.7,4][a];if(p)value-=[0,.25,1.7,4][p]}return value}
function chooseLineMove(board,difficulty='normal',rng=Math.random){const empties=board.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(!empties.length)return -1;if(difficulty==='easy')return empties[Math.floor(rng()*empties.length)];let best=-Infinity,bestMoves=[];for(const move of empties){const next=lineStep(board,move,2);let score=lineEval(next);if(difficulty==='hard'){let worst=Infinity;for(const reply of empties){if(reply===move)continue;const response=lineStep(next,reply,1);worst=Math.min(worst,lineEval(response))}if(worst!==Infinity)score=worst+score*.15}if(score>best+1e-8){best=score;bestMoves=[move]}else if(Math.abs(score-best)<1e-8){bestMoves.push(move)}}return bestMoves[Math.floor(rng()*bestMoves.length)]}
const api={colors,shuffle,freshChain,canLink,chainMoves,chainPlace,chainReroll,chainOver,chainStars,windows,lineWindows,lineScore,centerScore,lineStep,newLineWindows,lineOver,lineResult,lineEval,chooseLineMove};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SoloEngine=api;
})(typeof window==='undefined'?globalThis:window);
