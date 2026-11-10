(function(){
'use strict';
const U=GameUpgrade;
function notes(s,count,save,root){
 if(root.querySelector('.digit-notes'))return;
 const form=root.querySelector('#baseball-form,#code-form');if(!form)return;
 form.insertAdjacentHTML('afterend',U.noteMarkup(s.view?.notes,count));const panel=root.querySelector('.digit-notes');panel.open=!!s.view?.notesOpen;
 panel.addEventListener('toggle',()=>{if(!panel.isConnected||!!s.view?.notesOpen===panel.open)return;s.view={...s.view,notesOpen:panel.open};save();});
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-digit-note],[data-note-reset]');if(!b)return;e.preventDefault();const a=U.notes(s.view?.notes,count);if(b.hasAttribute('data-note-reset'))a.fill(0);else a[+b.dataset.digitNote]=(a[+b.dataset.digitNote]+1)%3;s.view={...s.view,notes:a,notesOpen:panel.open};panel.querySelectorAll('[data-digit-note]').forEach((el,i)=>{el.dataset.mark=a[i];el.setAttribute('aria-label',`${i}: ${['미정','후보','제외'][a[i]]}`);el.querySelector('small').textContent=['미정','후보','제외'][a[i]];});save();});
}
function decorate(){
 const content=document.querySelector('#content');
 if(content&&typeof state!=='undefined'&&typeof active!=='undefined'&&active){
  if(state.id==='baseball')notes(state,10,()=>window.PopupProgress?.save(),content);
  const triple=content.querySelector('.board.triple');
  if(triple&&!state.locked){let bar=content.querySelector('.selection-tools');if(!bar){bar=document.createElement('div');bar.className='selection-tools';bar.innerHTML='<span></span><button type="button">선택 비우기</button>';triple.after(bar);bar.querySelector('button').onclick=()=>{if(state.locked)return;state.selection.slice().forEach(i=>selectTriple(i));window.PopupProgress?.save();decorate();};}const n=state.selection.length,t=`${n}/3장 선택 · 세 장을 고른 뒤 제출하세요.`;if(bar.firstElementChild.textContent!==t)bar.firstElementChild.textContent=t;bar.lastElementChild.disabled=n===0;}
  else content.querySelector('.selection-tools')?.remove();
  const memory=content.querySelector('.board.memory');if(memory){let strip=content.querySelector('.memory-collection');if(!strip){strip=document.createElement('p');strip.className='memory-collection';memory.after(strip);}const fruits=[...new Set([...memory.querySelectorAll('.matched')].map(b=>b.textContent))],t=`찾은 과일 ${fruits.length}/8 · ${fruits.join(' ')||'첫 짝을 찾아보세요'}`;if(strip.textContent!==t)strip.textContent=t;}
 }
 document.querySelectorAll('#chess-board,#online-board').forEach(board=>{let p=board.parentElement.querySelector('.move-count');if(!p){p=document.createElement('p');p.className='move-count';board.after(p);}const move=board.querySelectorAll('.target:not(.capture)').length,capture=board.querySelectorAll('.capture').length,chosen=board.querySelector('.chosen')||board.parentElement.querySelector('.hand-piece.chosen'),t=chosen?`선택한 말 · 이동 가능 ${move+capture}칸${capture?` · 포획 가능 ${capture}칸`:''}`:'내 말이나 보유 말을 선택하면 놓을 수 있는 칸을 알려드려요.';if(p.textContent!==t)p.textContent=t;});
}
function preview(e){const b=e.target.closest('[data-press]');document.querySelectorAll('.will-flip').forEach(x=>x.classList.remove('will-flip'));if(b&&!b.disabled)U.cross(+b.dataset.press).forEach(i=>document.querySelector(`[data-press="${i}"]`)?.classList.add('will-flip'));}
document.addEventListener('pointerover',preview);document.addEventListener('focusin',preview);document.addEventListener('pointerout',e=>{if(e.target.closest('[data-press]')&&!e.relatedTarget?.closest('[data-press]'))document.querySelectorAll('.will-flip').forEach(x=>x.classList.remove('will-flip'));});document.addEventListener('focusout',e=>{if(e.target.closest('[data-press]'))document.querySelectorAll('.will-flip').forEach(x=>x.classList.remove('will-flip'));});
window.GameUpgradeUI={notes};
let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decorate();});}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed']});decorate();
})();
