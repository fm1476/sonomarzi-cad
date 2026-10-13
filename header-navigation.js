/* Resilient top-level navigation for the header tabs. */
(()=>{
'use strict';
const nav=document.querySelector('header nav.cad-header-tabs');
if(!nav)return;
nav.addEventListener('click',e=>{
 const button=e.target.closest('button[data-view]');
 if(!button||!nav.contains(button))return;
 e.preventDefault();
 const view=button.dataset.view;
 if(!document.getElementById(view))return;
 if(typeof window.cadShowView==='function')window.cadShowView(view);
 else {
  document.querySelectorAll('main.view').forEach(el=>el.classList.toggle('active',el.id===view));
  nav.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===button));
  if(view==='calltake')window.cadCallTakeRefresh?.();
 }
});
nav.querySelectorAll('button[data-view]').forEach(button=>button.type='button');
})();
