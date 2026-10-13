/* Browser-local officer safety timer prototype. Not a live safety monitoring service. */
(()=>{
'use strict';
const KEY='smcad-officer-safety-v1', RULES='smcad-officer-safety-rules-v1';
const defaultRules={'Traffic Stop':{ONSCENE:2,C4:10},'Unwanted Subject':{ONSCENE:5,C4:10},'Domestic':{ONSCENE:3,C4:10}};
let saved={},rules={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}try{rules=JSON.parse(localStorage.getItem(RULES)||'{}')||{}}catch{}
const persist=()=>localStorage.setItem(KEY,JSON.stringify(saved)),persistRules=()=>localStorage.setItem(RULES,JSON.stringify(rules));
const norm=s=>String(s||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
const currentIncident=u=>(stateNow().incidents||[]).find(i=>i.status==='ACTIVE'&&i.units?.includes(u.id));
const stateNow=()=>window.cadSafetyState?.()||{};
function getRule(u){const inc=currentIncident(u),type=inc?.type||'Default',status=norm(u.status),agency=u.agency||'Unknown';const a=rules[agency]||{};const agencyType=a[type]||a.Default||{},preset=defaultRules[type]||{};return {agency,type,status,minutes:Number(agencyType[status]??agencyType.Default??preset[status]??(status==='C4'?10:5))||5};}
function sync(u){const rule=getRule(u),key=u.id+'|'+rule.agency,old=saved[key],signature=[rule.type,rule.status].join('|');if(!old){saved[key]={signature,minutes:rule.minutes,due:Date.now()+rule.minutes*60000,mode:'auto',ack:false};persist()}else if(old.signature!==signature){saved[key]={signature,minutes:rule.minutes,due:Date.now()+rule.minutes*60000,mode:'auto',ack:false};persist()}return {key,rule,t:saved[key]}}
let audioEnabled=false,lastAudio=new Map();
function sound(u,t){if(!audioEnabled||t.mode==='stopped'||t.ack||t.due>Date.now())return;const last=lastAudio.get(u.id)||0;if(Date.now()-last<30000)return;lastAudio.set(u.id,Date.now());try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.value=.09;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.16);osc.onended=()=>ctx.close();if('speechSynthesis'in window){const utterance=new SpeechSynthesisUtterance('Status check. '+String(u.id).replace(/([0-9])([A-Za-z])([0-9])/g,(_,a,b,c)=>a+' '+({'A':'Adam','B':'Boy','C':'Charles','D':'David'}[b.toUpperCase()]||b)+' '+c));utterance.rate=.9;window.speechSynthesis.speak(utterance)}}catch(e){console.warn('Officer safety audio unavailable',e)}}
function fmt(ms){const secs=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')}
function refresh(){const units=stateNow().units||[];document.querySelectorAll('#units .cad-unit-grid').forEach(row=>{const id=row.dataset.dragUnit,u=units.find(x=>x.id===id);if(!u||(!currentIncident(u)&&!['ONSCENE','C4'].includes(norm(u.status))))return;const {key,rule,t}=sync(u);const cell=row.querySelector('.board-unit-pill');if(!cell)return;let button=row.querySelector('.cad-safety-clock');if(!button){button=document.createElement('button');button.type='button';button.className='cad-safety-clock';button.dataset.safetyUnit=id;button.title='Officer safety timer controls';button.textContent='⏰';cell.append(button)}const due=t.mode!=='stopped'&&Date.now()>=t.due;button.classList.toggle('cad-safety-due',due);button.classList.toggle('cad-safety-stopped',t.mode==='stopped');button.textContent=(t.mode==='stopped'?'◷':due?'⏰':'◴')+' '+(t.mode==='stopped'?'OFF':fmt(t.due-Date.now()));button.setAttribute('aria-label','Officer safety timer '+id+' '+button.textContent);if(due)sound(u,t);})}
function popup(u){
 const {rule,t}=sync(u);let d=document.getElementById('cadSafetyDialog');
 if(!d){d=document.createElement('dialog');d.id='cadSafetyDialog';d.className='cad-safety-dialog cad-safety-modern';document.body.append(d)}
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;':'&#39;'}[c]));
 const remaining=t.mode==='stopped'?'Paused':fmt(t.due-Date.now());
 d.innerHTML=`<div class="cad-safety-shell">
 <header class="cad-safety-top"><div><div class="cad-safety-eyebrow">UNIT SAFETY MONITOR</div><h3>${esc(u.id)} <span class="cad-safety-status-dot"></span></h3></div><button type="button" class="cad-safety-close" aria-label="Close">✕</button></header>
 <div class="cad-safety-context"><span>${esc(rule.agency)}</span><span>${esc(rule.type)}</span><span>${esc(u.status)}</span></div>
 <div class="cad-safety-readout"><div><small>TIME REMAINING</small><strong>${remaining}</strong></div><div class="cad-safety-rule"><small>CURRENT INTERVAL</small><strong>${t.minutes} min</strong><span>${t.mode==='auto'?'Agency automatic':t.mode==='stopped'?'Monitoring suspended':'Manual override'}</span></div></div>
 <div class="cad-safety-section-title">Quick actions</div>
 <div class="cad-safety-action-grid"><button type="button" data-action="reset">↻ <span>Reset timer</span></button><button type="button" data-action="ack">✓ <span>Acknowledge</span></button><button type="button" data-action="stop">${t.mode==='stopped'?'▶':'Ⅱ'} <span>${t.mode==='stopped'?'Resume':'Stop'} timer</span></button></div>
 <div class="cad-safety-section-title">Change monitoring interval</div>
 <div class="cad-safety-presets">${[2,5,10,15].map(n=>`<button type="button" data-preset="${n}" class="${t.minutes===n?'is-selected':''}">${n} min</button>`).join('')}</div>
 <div class="cad-safety-custom"><label for="cadSafetyMinutes">Custom minutes</label><input id="cadSafetyMinutes" type="number" min="1" max="240" value="${t.minutes}"><button type="button" data-action="change" class="cad-safety-primary">Apply</button></div>
 <div class="cad-safety-footer"><button type="button" data-action="automatic">↺ Return to agency rules</button><button type="button" data-action="config">⚙ Agency rules</button></div>
 <p class="cad-safety-disclaimer">Local CAD prototype · Not certified for live officer safety monitoring</p></div>`;
 const close=()=>d.close();
 d.querySelector('.cad-safety-close').onclick=close;
 const act=(action,minutes)=>{
  if(action==='config'){close();configure(rule.agency);return}
  if(action==='stop'&&t.mode!=='stopped'){t.mode='stopped';t.ack=true;delete t.reason}
  else if(action==='stop'){t.mode='manual';t.due=Date.now()+t.minutes*60000;t.ack=false}
  else if(action==='reset'){t.due=Date.now()+t.minutes*60000;t.ack=false;if(t.mode==='stopped')t.mode='manual'}
  else if(action==='ack'){t.ack=true}
  else if(action==='change'){if(!Number.isFinite(minutes)||minutes<1||minutes>240)return;t.minutes=minutes;t.due=Date.now()+minutes*60000;t.mode='manual';t.ack=false}
  else if(action==='automatic'){t.minutes=rule.minutes;t.due=Date.now()+rule.minutes*60000;t.mode='auto';t.ack=false}
  else return;
  t.lastAction={action,time:new Date().toISOString()};persist();close();refresh();
 };
 d.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action,Number(d.querySelector('#cadSafetyMinutes').value)));
 d.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>act('change',Number(b.dataset.preset)));
 d.showModal();
}
function configure(agency){let d=document.getElementById('cadSafetyRules');if(!d){d=document.createElement('dialog');d.id='cadSafetyRules';d.className='cad-safety-dialog';document.body.append(d)}const current=rules[agency]||{};d.innerHTML='<form method="dialog"><h3>Agency officer safety rules</h3><p>'+agency+' · Local prototype only</p><label>CFS type <input name="type" value="Traffic Stop" required></label><label>Status <select name="status"><option>ONSCENE</option><option>C4</option><option>AVAILABLE</option><option>ENROUTE</option><option>Default</option></select></label><label>Minutes <input name="minutes" type="number" min="1" max="240" value="2" required></label><p>Configured: '+Object.entries(current).map(([k,v])=>k+': '+Object.entries(v).map(([s,m])=>s+' '+m+'m').join(', ')).join(' | ')+'</p><button value="save">Save rule</button><button value="cancel">Close</button></form>';d.onclose=()=>{if(d.returnValue!=='save')return;const form=d.querySelector('form'),type=form.elements.type.value.trim(),status=form.elements.status.value,minutes=Number(form.elements.minutes.value);if(!type||!Number.isFinite(minutes)||minutes<1||minutes>240)return;(rules[agency]??={})[type]??={};rules[agency][type][status]=minutes;persistRules()};d.showModal()}
document.addEventListener('click',e=>{const b=e.target.closest('.cad-safety-clock');if(!b)return;e.preventDefault();e.stopPropagation();const u=(stateNow().units||[]).find(x=>x.id===b.dataset.safetyUnit);if(u)popup(u)},true);
const enable=document.createElement('button');enable.type='button';enable.className='cad-safety-enable';enable.textContent='Officer safety audio: Off';enable.setAttribute('aria-pressed','false');enable.onclick=()=>{audioEnabled=!audioEnabled;enable.textContent='Officer safety audio: '+(audioEnabled?'On':'Off');enable.setAttribute('aria-pressed',String(audioEnabled));if(!audioEnabled){lastAudio.clear();try{window.speechSynthesis?.cancel()}catch{}}};document.querySelector('[data-panel="units"] .filters')?.append(enable);
setInterval(refresh,1000);setTimeout(refresh,500);
})();
