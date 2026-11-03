(function(root){
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const combinations=a=>{let out=[];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)for(let k=j+1;k<a.length;k++)out.push([i,j,k]);return out};
function matches(cards,ids,target){return target.every((same,d)=>{let count=new Set(ids.map(i=>cards[i][d])).size;return same?count===1:count===3})}
function puzzle(){let pool=[];for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++)pool.push([a,b,c]);let combos=combinations(Array(9).fill(0));for(let tries=0;tries<20000;tries++){let cards=shuffle(pool).slice(0,9),target=Array.from({length:3},()=>Math.random()<.5);let solutions=combos.filter(ids=>matches(cards,ids,target));if(solutions.length===1)return {cards,target,answer:solutions[0]}}throw Error('문제 생성 실패. 다시 시작해주세요.')}
const tripleScore=(remaining)=>100+Math.max(0,Math.min(40,Math.ceil(remaining)));
const memoryScore=(elapsed,errors)=>Math.max(0,1000-5*Math.floor(elapsed)-40*errors);
function bluff(a,b,at=false,bt=false){if(at&&bt)return {a:0,b:0,gapA:0,gapB:0};if(at)return {a:0,b:1,gapA:0,gapB:Math.max(0,b-a)};if(bt)return {a:1,b:0,gapA:Math.max(0,a-b),gapB:0};return {a:+(a>b),b:+(b>a),gapA:Math.max(0,a-b),gapB:Math.max(0,b-a)}}
function lightsMask(index){let mask=1<<index,row=Math.floor(index/4),column=index%4;if(row>0)mask|=1<<(index-4);if(row<3)mask|=1<<(index+4);if(column>0)mask|=1<<(index-1);if(column<3)mask|=1<<(index+1);return mask}
function createLights(){let board=shuffle(Array.from({length:16},(_,i)=>i)).slice(0,6+Math.floor(Math.random()*5)).reduce((value,index)=>value^lightsMask(index),0);if(board===0)board=lightsMask(0);return {board,moves:0,status:'playing'}}
function pressLights(game,index){if(game.status!=='playing'||!Number.isInteger(index)||index<0||index>15)return game;const board=game.board^lightsMask(index);return {board,moves:game.moves+1,status:board===0?'won':'playing'}}
function createBaseball(length=3){if(length!==3&&length!==4)throw new RangeError('3자리 또는 4자리를 선택하세요.');return {length,secret:shuffle('0123456789').slice(0,length).join(''),attempts:[],status:'playing'}}
function baseballScore(secret,guess){let strikes=0,balls=0;for(let i=0;i<secret.length;i++){if(guess[i]===secret[i])strikes++;else if(secret.includes(guess[i]))balls++}return {strikes,balls}}
function guessBaseball(game,guess){
if(game.status!=='playing')return {game,error:'종료된 경기입니다. 다시 도전해주세요.'};
if(typeof guess!=='string'||!/^\d+$/.test(guess)||guess.length!==game.length)return {game,error:`숫자 ${game.length}자리를 입력해주세요. 0으로 시작해도 됩니다.`};
if(new Set(guess).size!==game.length)return {game,error:'같은 숫자는 한 번만 사용할 수 있어요.'};
if(game.attempts.some(a=>a.guess===guess))return {game,error:'이미 시도한 숫자입니다. 기록을 확인해주세요.'};
let result=baseballScore(game.secret,guess),attempts=[...game.attempts,{guess,...result}];return {game:{...game,attempts,status:result.strikes===game.length?'won':attempts.length>=10?'lost':'playing'},error:''};
}
const api={shuffle,combinations,matches,puzzle,tripleScore,memoryScore,bluff,lightsMask,createLights,pressLights,createBaseball,baseballScore,guessBaseball};if(typeof module!=='undefined')module.exports=api;root.Engine=api;
})(typeof window==='undefined'?globalThis:window);
