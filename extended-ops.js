/* v15: EMS hospital arrival and ad-hoc radio unit logon. */
(()=>{
'use strict';
const previous=window.cadBeforeVoiceProcess;
const normalize=text=>String(text||'').toLowerCase().replace(/\bbatallion\b/g,'battalion').replace(/\b(?:atom|addam)\b/g,'adam').replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim();
const numbers={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50};
function readNumber(text){if(/^\d+$/.test(text))return String(Number(text));const tokens=text.trim().split(/\s+/),values=tokens.map(x=>numbers[x]);if(values.some(x=>x===undefined))return null;if(values.length===2&&values[0]>=20&&values[1]<10)return String(values[0]+values[1]);if(values.length===1)return String(values[0]);return null;}
function getCallsign(text){
 const t=normalize(text).replace(/^(?:dispatch|radio|unit)\s+/,'');
 let m=t.match(/\b(medic|engine|truck|battalion chief|battalion|rescue)\s+(\d{1,3}|(?:twenty|thirty|forty)\s+\w+|[a-z]+)\b/);
 if(m){const n=readNumber(m[2]);if(n)return {id:({medic:'M',engine:'E',truck:'T',battalion:'B','battalion chief':'B',rescue:'R'})[m[1]]+n,discipline:m[1]==='medic'?'EMS':'FIRE'};}
 m=t.match(/\b([1-9]|one|two|three|four|five|six|seven|eight|nine)\s+(?:adam|alpha|a)\s+(\d{1,3}|(?:twenty|thirty|forty)\s+\w+|[a-z]+)\b/);
 if(m){const x=readNumber(m[1]),y=readNumber(m[2]);if(x&&y)return{id:x+'A'+y,discipline:'LAW'};}
 m=t.match(/\b(\d+A\d+|[a-z]{1,3}\d{1,3})\b/i);
 if(m){const id=m[1].toUpperCase();if(/^(M|E|T|B|R)\d+$/.test(id))return{id,discipline:id[0]==='M'?'EMS':'FIRE'};if(/^\d+A\d+$/.test(id))return{id,discipline:'LAW'};}
 return null;
}
function getCallsigns(text){
 // Parse every explicit radio designator, including units that have not logged on yet.
 // Prevent a unit in an address or an isolated number from being mistaken for a callsign.
 const t=normalize(text), entries=[];
 const pattern=/\b(?:battalion\s+chief|battalion|engine|truck|medic|rescue)\s+(?:\d{1,3}|(?:twenty|thirty|forty|fifty)\s+\w+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine)\s+(?:adam|alpha|a)\s+(?:\d{1,3}|(?:twenty|thirty|forty)\s+\w+|one|two|three|four|five|six|seven|eight|nine)\b|\b(?:\d+a\d+|[emtbr]\d{1,3})\b/gi;
 for(const match of t.matchAll(pattern)){
  const unit=getCallsign(match[0]);
  if(unit&&!entries.some(x=>x.id===unit.id))entries.push(unit);
 }
 return entries;
}
function feedback(text,msg,good=true){
 document.getElementById('voiceHeard').textContent=text;
 document.getElementById('voiceInterpretation').textContent='v15 | '+msg;
 document.getElementById('opsInfo').textContent=msg;
 state.voiceActivity ||= [];state.voiceActivity.unshift(new Date().toLocaleTimeString('en-US',{hour12:false})+' '+msg);
 save();if(typeof renderActivity==='function')renderActivity();
 document.getElementById('voiceIndicator').textContent=good?'PROCESSED':'REVIEW';
}
window.cadBeforeVoiceProcess=(text,source)=>{
 const t=normalize(text),identity=getCallsign(text);
 const logon=/\b(?:logging|log|signing|sign|checking|check|coming)\s+(?:myself\s+)?(?:on|in)\b|\b(?:in service|10 ?8|ten eight|starting shift|beginning shift)\b/.test(t);
 const hospital=/\b(?:at|arrived at|arriving at|out at|to the|at the)\s+(?:the\s+)?hospital\b|\b(?:hospital arrival|at hospital)\b/.test(t);
 if(logon||hospital){
  // Capture a reversible radio-action snapshot before any changes.
  if(previous?.(text,source)===true)return true;
  const identities=logon&&!hospital?getCallsigns(text):identity?[identity]:[];
  if(!identities.length){feedback(text,'REVIEW: Cannot identify unit for '+(hospital?'hospital arrival':'unit logon')+'. No changes applied.',false);return true;}
  let unit=state.units.find(u=>u.id===identities[0].id);
  if(hospital){
   if(!unit||unit.discipline!=='EMS'){feedback(text,'REVIEW: Hospital arrival requires a known EMS unit. No changes applied.',false);return true;}
   if(unit.status!=='TRANSPORTING'&&unit.status!=='AT_HOSPITAL'){feedback(text,'REVIEW: '+unit.id+' is '+unit.status+', not transporting. Confirm hospital arrival manually.',false);return true;}
   const from=unit.status;unit.status='AT_HOSPITAL';unit.location='Hospital';
   const assigned=state.incidents.filter(i=>i.status==='ACTIVE'&&i.units.includes(unit.id));
   if(assigned.length===1)event(assigned[0],`VOICE_UNIT_STATUS ${unit.id} ${from} -> AT_HOSPITAL`);
   feedback(text,unit.id+' '+from+' → AT HOSPITAL. Unit remains unavailable until explicitly cleared.');return true;
  }
  const outcomes=[];let blocked=false;
  for(const entry of identities){
   let current=state.units.find(u=>u.id===entry.id);
   if(!current){
    const agency=entry.discipline==='LAW'?'Petaluma Police':'Petaluma Fire / EMS';
    current={id:entry.id,agency,discipline:entry.discipline,status:'AVAILABLE',location:'Available',x:25+(state.units.length*7)%50,y:25+(state.units.length*11)%50};
    state.units.push(current);outcomes.push(`${entry.id} created and AVAILABLE`);continue;
   }
   if(state.incidents.some(i=>i.status==='ACTIVE'&&i.units.includes(entry.id))){
    blocked=true;outcomes.push(`${entry.id} already assigned: no status change`);continue;
   }
   const before=current.status;current.status='AVAILABLE';current.location='Available';
   outcomes.push(`${entry.id} ${before} → AVAILABLE`);
  }
  feedback(text,(blocked?'REVIEW: ':'UNIT LOGON: ')+outcomes.join('; '),!blocked);return true;
 }
 return previous?.(text,source)===true;
};
})();
