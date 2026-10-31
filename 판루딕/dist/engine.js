(function(root){
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const combinations=a=>{let out=[];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)for(let k=j+1;k<a.length;k++)out.push([i,j,k]);return out};
function matches(cards,ids,target){return target.every((same,d)=>{let count=new Set(ids.map(i=>cards[i][d])).size;return same?count===1:count===3})}
function puzzle(){let pool=[];for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++)pool.push([a,b,c]);let combos=combinations(Array(9).fill(0));for(let tries=0;tries<20000;tries++){let cards=shuffle(pool).slice(0,9),target=Array.from({length:3},()=>Math.random()<.5);let solutions=combos.filter(ids=>matches(cards,ids,target));if(solutions.length===1)return {cards,target,answer:solutions[0]}}throw Error('문제 생성 실패. 다시 시작해주세요.')}
const tripleScore=(remaining)=>100+Math.max(0,Math.min(40,Math.ceil(remaining)));
const memoryScore=(elapsed,errors)=>Math.max(0,1000-5*Math.floor(elapsed)-40*errors);
function bluff(a,b,at=false,bt=false){if(at&&bt)return {a:0,b:0,gapA:0,gapB:0};if(at)return {a:0,b:1,gapA:0,gapB:Math.max(0,b-a)};if(bt)return {a:1,b:0,gapA:Math.max(0,a-b),gapB:0};return {a:+(a>b),b:+(b>a),gapA:Math.max(0,a-b),gapB:Math.max(0,b-a)}}
const api={shuffle,combinations,matches,puzzle,tripleScore,memoryScore,bluff};if(typeof module!=='undefined')module.exports=api;root.Engine=api;
})(typeof window==='undefined'?globalThis:window);
