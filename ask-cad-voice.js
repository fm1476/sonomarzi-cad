/* v16.7: Read-only Board Intelligence PTT; never calls the radio transaction handler. */
(()=>{
'use strict';
const button=document.getElementById('cadAskPTT'),status=document.getElementById('cadAskMicStatus'),speak=document.getElementById('cadSpeakReply');
if(!button)return;
let recorder=null,stream=null,chunks=[],isHolding=false,starting=false,pending=false,releasing=false,session=0;
const setStatus=(message,error=false)=>{status.textContent=message;status.classList.toggle('cad-ask-error',error)};
const ui=()=>{button.classList.toggle('cad-ask-recording',isHolding);button.disabled=pending;button.textContent=isHolding?'🔴 Listening… release to ask':pending?'Transcribing…':'🎙 Hold to Ask'};
const cleanup=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}};
const mime=()=>['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
async function askAudio(blob,id){pending=true;ui();setStatus('Transcribing your question securely through OpenAI…');
try{
 if(blob.size<150||blob.size>3500000)throw new Error('Recording too short or too large (30 seconds maximum).');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
 let response;try{response=await fetch('/.netlify/functions/transcribe',{method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob,signal:ctrl.signal})}finally{clearTimeout(timer)}
 if(!response.ok)throw new Error('Transcription service returned HTTP '+response.status);
 const data=await response.json();if(id!==session)return;
 const question=String(data.text||'').trim();if(!question)throw new Error('No question was recognized.');
 // This is read-only. Never route questions through process(), CAD PTT, or command execution.
 const reply=window.cadAskQuestion?.(question);if(typeof reply!=='string')throw new Error('Board Intelligence is not ready.');
 setStatus('Heard: '+question);
 if(speak.checked&&'speechSynthesis'in window){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(reply);utterance.rate=1;window.speechSynthesis.speak(utterance)}
}catch(err){if(id===session)setStatus('Unable to answer by voice: '+(err?.name==='AbortError'?'transcription timed out':err.message)+'. You can still type your question.',true)}
finally{pending=false;ui()}
}
async function start(){if(starting||pending||isHolding)return;
const id=++session;isHolding=true;starting=true;releasing=false;chunks=[];ui();setStatus('Listening to your question…');
try{
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Browser audio recording is unavailable.');
 stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
 if(id!==session){cleanup();return}
 const type=mime();recorder=new MediaRecorder(stream,type?{mimeType:type}:{});const current=recorder;
 current.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
 current.onstop=()=>{if(id!==session)return;cleanup();askAudio(new Blob(chunks,{type:current.mimeType||'audio/webm'}),id)};
 current.onerror=()=>{setStatus('Audio recorder error. Please type your question.',true);cleanup();isHolding=false;ui()};
 current.start();if(releasing)stop();setTimeout(()=>{if(id===session&&isHolding)stop()},30000);
}catch(err){cleanup();isHolding=false;setStatus('Microphone not available: '+err.message,true);ui()}finally{starting=false;if(releasing)stop()}
}
function stop(){if(!isHolding)return;isHolding=false;releasing=true;ui();if(starting)return;if(recorder?.state==='recording'){try{recorder.stop()}catch(err){cleanup();setStatus('Could not stop recording.',true)}}else cleanup()}
button.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();button.setPointerCapture?.(e.pointerId);start()});
button.addEventListener('pointerup',e=>{e.preventDefault();stop()});button.addEventListener('pointercancel',stop);
button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start()}});
button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();stop()}});
window.addEventListener('blur',()=>{if(isHolding)stop()});
})();
