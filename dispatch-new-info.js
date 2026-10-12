/* Dispatch-side unread call-taker updates; browser-local prototype. */
(()=>{
'use strict';
const KEY='smcad-dispatch-info-read-v1',SOUND='smcad-dispatch-info-sound-v1';
let read={};try{read=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
let soundOn=localStorage.getItem(SOUND)==='yes',lastSeen={};
const state=()=>window.cadSafetyState?.()||{};
function chime(){if(!soundOn)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=660;gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.035,ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.28);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.3);osc.onended=()=>ctx.close()}catch(e){console.warn('New-info audio unavailable',e)}}
function refresh(){const incidents=state().incidents||[];for(const i of incidents){const stamp=i.callTakeNewInfoAt;if(stamp&&stamp!==lastSeen[i.id]){if(lastSeen[i.id]&&stamp!==read[i.id])chime();lastSeen[i.id]=stamp}}document.querySelectorAll('#pending .row[data-id],#activeCalls .row[data-id]').forEach(row=>{const i=incidents.find(x=>x.id===row.dataset.id);if(!i)return;let badge=row.querySelector('.cad-dispatch-new-info');const unread=i.callTakeNewInfoAt&&read[i.id]!==i.callTakeNewInfoAt;if(unread&&!badge){badge=document.createElement('span');badge.className='cad-dispatch-new-info';badge.textContent='● NEW INFO';badge.title='New narrative information added from Call Taking';row.append(badge)}else if(!unread&&badge)badge.remove()})}
window.cadDispatchInfoRead=(id,stamp)=>{if(!stamp||read[id]===stamp)return;read[id]=stamp;localStorage.setItem(KEY,JSON.stringify(read))};
window.cadDispatchInfoRefresh=refresh;
const bar=document.createElement('label');bar.className='cad-dispatch-info-audio';bar.innerHTML='<input type="checkbox" '+(soundOn?'checked':'')+'> Soft new-info chime';bar.querySelector('input').onchange=e=>{soundOn=e.target.checked;localStorage.setItem(SOUND,soundOn?'yes':'no');if(soundOn)chime()};
document.querySelector('[data-panel="detail"] h2')?.append(bar);
window.addEventListener('storage',()=>setTimeout(refresh,50));
setInterval(refresh,1800);setTimeout(refresh,350);
})();
