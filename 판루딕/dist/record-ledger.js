/* Best records are independent of the bounded recent-history list. */
(function(root){'use strict';
function create(storage,history,valid,bucket){
 const key=history+'.best.v1';
 bucket=bucket||function(r){return JSON.stringify([r.game,r.ruleVersion||r.version,r.mode,r.difficulty,r.starter,r.outcome]);};
 function select(rows){const groups=new Map();for(const r of rows.filter(valid)){const k=bucket(r),a=groups.get(k)||[];a.push(r);groups.set(k,a);}const out=[];for(const a of groups.values()){const score=a.filter(r=>Number.isFinite(r.score)).sort((a,b)=>b.score-a.score)[0],moves=a.filter(r=>Number.isFinite(r.moves)).sort((a,b)=>a.moves-b.moves)[0],attempts=a.filter(r=>r.won&&Number.isFinite(r.attempts)).sort((a,b)=>a.attempts-b.attempts)[0];for(const r of[score,moves,attempts])if(r&&!out.some(x=>JSON.stringify(x)===JSON.stringify(r)))out.push(r);}return out;}
 function remember(incoming=[]){let saved=[],invalid=false;const raw=storage.getItem(key);if(raw){try{const x=JSON.parse(raw);if(!Array.isArray(x))throw Error();saved=x.filter(valid);invalid=saved.length!==x.length;}catch{invalid=true;}}if(invalid&&!storage.getItem(key+'.backup'))storage.setItem(key+'.backup',raw);const rows=select([...saved,...incoming]),next=JSON.stringify(rows);if(next!==raw)storage.setItem(key,next);return rows;}
 function read(){try{const raw=storage.getItem(history),rows=raw?JSON.parse(raw):[];return{rows:remember(Array.isArray(rows)?rows:[]),error:''};}catch{return{rows:[],error:'최고 기록을 보존하지 못했습니다. 저장 공간을 확인해주세요.'};}}
 return {key,remember,read};
}
const api={create};if(typeof module!=='undefined')module.exports=api;root.RecordLedger=api;
})(typeof window==='undefined'?globalThis:window);
