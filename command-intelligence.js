/* CAD v16: deterministic keyboard transactions and read-only board intelligence. */
(()=>{
'use strict';
const input=document.getElementById('command'), sugg=document.getElementById('cadSuggestions'), results=document.getElementById('cadCommandResults');
const ask=document.getElementById('cadAsk'), answer=document.getElementById('cadAnswer');
const help='CE #4525 ,report taken | CL / TS can appear anywhere: TS 3A12 @address@ .plate. ,remarks OR @address@ ,remarks, TS .plate. 3A12. Natural typed traffic-stop and change-location phrases also supported. | D Dispatch | DE Dispatch & enroute | E Enroute | OS On scene | C4 Code 4 | AOS Available on scene | A Available | C Clear | T Transport | AH At hospital | RT Radio traffic/narrative | PRE Preempt. Separate independent commands with ; . Use #4525 to reference an incident. Example: OS E1; C M2; D 3A12 #4518; RT #4518 Additional unit requested. Event context: #4525: OS E1; C E2; RT Fire under control.';
const statusCodes={E:'ENROUTE',OS:'ONSCENE',C4:'CODE4',AOS:'AVAILABLE_ON_SCENE',A:'AVAILABLE',T:'TRANSPORTING',AH:'AT_HOSPITAL'};
const units=()=>state.units, incidents=()=>state.incidents;
const unit=id=>units().find(u=>u.id===String(id||'').toUpperCase());
const owner=u=>incidents().filter(i=>i.status==='ACTIVE'&&i.units.includes(u.id));
const allCurrent=()=>incidents().filter(i=>i.status!=='CLOSED');
function resolve(ref){const token=String(ref||'').replace(/^#/,'').toLowerCase();if(!token)return{error:'Choose a CFS after #.'};const matches=allCurrent().filter(i=>i.id.toLowerCase()===token||i.id.split('-').at(-1).endsWith(token));if(!matches.length)return{error:`No open CFS matches #${token}.`};if(matches.length!==1)return{error:`Ambiguous #${token}: ${matches.map(i=>i.id).join(', ')}. Select a full event number.`};return{incident:matches[0]};}
function contextFor(u, explicit){if(explicit){const ref=resolve(explicit);if(ref.error)return ref;if(!ref.incident.units.includes(u.id))return{error:`${u.id} is not assigned to ${ref.incident.id}.`};return ref;}const found=owner(u);if(found.length!==1)return{error:`${u.id} has ${found.length} active assignments; specify a CFS.`};return{incident:found[0]};}
const ok=message=>({ok:true,message}),fail=message=>({ok:false,message});
function recordAction(i,u,before,after,source){event(i,`COMMAND_UNIT_STATUS ${u.id} ${before} -> ${after} (${source})`);}
function dispatchUnit(u,i,code){const assigned=owner(u),others=assigned.filter(x=>x.id!==i.id);if(u.status==='OUT_OF_SERVICE')return fail(`${u.id} is OUT OF SERVICE.`);if(others.length)return fail(`DISPATCH CONFLICT: ${u.id} already assigned to ${others.map(x=>`${x.id} ${x.type} at ${x.location}`).join('; ')}. Use PRE to transfer.`);const resolved=cadDispatchTarget(i,u);if(resolved.error)return fail(resolved.error);const target=resolved.incident;if(!target.units.includes(u.id))target.units.push(u.id);target.status='ACTIVE';const prev=u.status;u.status=code==='DE'?'ENROUTE':'DISPATCHED';u.location=target.location;event(target,`COMMAND_${code} ${u.id} ${prev} -> ${u.status}`);state.selected=target.id;return ok(`${u.id} ${u.status} → ${target.id} ${target.type}${resolved.linked?' (linked from '+i.id+')':''}.`)}
function preempt(u,i){const old=owner(u).filter(x=>x.id!==i.id);if(u.status==='OUT_OF_SERVICE')return fail(`${u.id} OUT OF SERVICE: preemption declined.`);for(const x of old){x.units=x.units.filter(id=>id!==u.id);event(x,`UNIT_PREEMPTED ${u.id} -> ${i.id}`);if(!x.units.length){x.status='PENDING';event(x,'INCIDENT_RETURNED_PENDING NO_DISPOSITION')}}const resolved=cadDispatchTarget(i,u);if(resolved.error)return fail(resolved.error);const target=resolved.incident;if(!target.units.includes(u.id))target.units.push(u.id);target.status='ACTIVE';u.status='DISPATCHED';u.location=target.location;event(target,`PREEMPT_RECEIVED ${u.id} from ${old.map(x=>x.id).join(', ')||'unassigned'}`);state.selected=target.id;return ok(`${u.id} PREEMPTED ${old.map(x=>x.id).join(', ')||'unassigned'} → ${target.id}${resolved.linked?' (linked from '+i.id+')':''}.`)}
function execOne(part, context){let text=part.trim();if(!text)return null; /* Keep @common place@ intact for the structured parser and per-field resolution. */const self=window.cadSelfInitiated?.typed(text);if(self)return self;if(/^HELP$/i.test(text))return ok(help);
 const ce=text.match(/^CE\s+(#(?:[\w-]+))\s*(?:,\s*([\s\S]*))?$/i);
 if(ce){const target=resolve(ce[1]);if(target.error)return fail(target.error);
  const disposition=(ce[2]||'').trim();if(!disposition)return fail('CE requires a disposition: CE #4525 ,report taken');
  const outcome=window.cadCloseEvent(target.incident,disposition,'COMMAND');return outcome.ok?ok(outcome.message):fail(outcome.message);
 }
 if(/^CE\b/i.test(text))return fail('Syntax: CE #4525 ,report taken (disposition required).');const newContext=text.match(/^#([\w-]+)\s*:\s*(.*)$/);if(newContext){const resolved=resolve(newContext[1]);if(resolved.error)return fail(resolved.error);context.ref='#'+resolved.incident.id;context.incident=resolved.incident;if(!newContext[2])return ok(`Context set to ${resolved.incident.id}.`);text=newContext[2];}
 // Structured location marker: @address@, plate/person token: .identifier., optional narrative: ,remarks.
 const parsed=window.cadStructuredParse.parse(text,units().map(u=>u.id));
 if(parsed.error)return fail(parsed.error);
 let command=parsed;
 if(!parsed.code){const natural=window.cadStructuredParse.natural(text,units().map(u=>u.id));if(natural?.error)return fail(natural.error);if(natural)command=natural;}
 if(command.code){
  const {code,unit:unitId,address:rawAddress,identifier,notes,residual}=command;
  if(!unitId)return fail('Specify one known unit ID anywhere outside delimited fields.');
  if(residual)return fail(`Unrecognized command text: ${residual}. Use @address@, .identifier., and ,remarks,.`);
  const u=unit(unitId);if(!u)return fail(`Unknown unit: ${unitId}.`);
  const address=window.cadCommonPlaces?.resolve(rawAddress.trim())?.address||rawAddress.trim();if(!address)return fail('A valid location is required. Use @address@ to make it explicit.');
  if(code.toUpperCase()==='CL'){const old=u.location;u.location=address;delete u.mapCoords;u.mapLocationPending=true;
   const assigned=owner(u);for(const i of assigned)event(i,`COMMAND_LOCATION_CHANGE ${u.id} ${old} -> ${address}`);
   window.cadResolveUnitAddress?.(u.id,address);return ok(`${u.id}: location ${old} → ${address}; map validation requested.`)}
  const tsRule=config.selfInitiated?.LAW?.['Traffic Stop'];if(tsRule?.enabled===false)return fail('Traffic Stop self-initiation is disabled in Configuration.');
  if(u.discipline!=='LAW')return fail(`${u.id} is not a LAW unit.`);
  if(owner(u).length||!['AVAILABLE','CLEAR'].includes(u.status))return fail(`${u.id} is not available to initiate a traffic stop.`);
  const id=`${String(new Date().getFullYear()).slice(-2)}-${String(++state.seq).padStart(6,'0')}`;
  const remarks=(notes||'').trim(), plate=(identifier||'').trim();
  const i={id,agency:u.agency,discipline:'LAW',priority:'P3',type:'Traffic Stop',location:address,caller:'OFFICER INITIATED',phone:'',narrative:[`Self-initiated by ${u.id}${plate?' | Plate/person: '+plate:''}${remarks?' | '+remarks:''}`],status:'ACTIVE',units:[u.id],events:[],plateOrPerson:plate,remarks};
  state.incidents.push(i);u.status=tsRule?.status||'ONSCENE';u.location=address;delete u.mapCoords;u.mapLocationPending=true;event(i,`COMMAND_TRAFFIC_STOP ${u.id} @${address}@ ${plate} ${remarks}`);state.selected=id;
  window.cadResolveUnitAddress?.(u.id,address);
  return ok(`Created ${id} Traffic Stop; ${u.id} ${u.status.replace('ONSCENE','ON SCENE')} at ${address}${plate?' | '+plate:''}.`);
 }
 if(/\b(CL|TS)\b/i.test(text))return fail('Syntax: TS 3A12 @1562 Henry Way@ .SAM123. ,red Toyota truck OR @1562 Henry Way@ ,red Toyota truck, TS .SAM123. 3A12');
 const m=text.match(/^(DE|PRE|AOS|C4|OS|AH|RT|D|E|C|A|T)\b\s*(.*)$/i);if(!m)return fail(`Unknown command: ${text}. Type HELP.`);
 const code=m[1].toUpperCase();let rest=m[2].trim();
 if(code==='RT') {const refMatch=rest.match(/#([\w-]+)/);let target;if(refMatch){const res=resolve(refMatch[1]);if(res.error)return fail(res.error);target=res.incident;rest=rest.replace(refMatch[0],'').trim();}else{const x=rest.match(/^([\dA-Z]+)\b/i),u=x&&unit(x[1]);if(u){const ass=owner(u);if(ass.length!==1)return fail(`Cannot uniquely resolve assigned event for ${u.id}.`);target=ass[0];rest=rest.slice(x[0].length).trim();}else if(context.incident){target=context.incident;}else return fail('RT requires a CFS reference (#4525) or an assigned unit (RT E1 ...).');}if(!rest)return fail('RT requires narrative text.');target.narrative.push(rest);event(target,`COMMAND_RADIO_TRAFFIC ${rest.slice(0,160)}`);return ok(`RT added to ${target.id}: ${rest}`)}
 const idMatch=rest.match(/#([\w-]+)/),ref=idMatch?'#'+idMatch[1]:context.ref;const utext=(idMatch?rest.replace(idMatch[0],''):rest).trim();const unitIds=utext.split(/[\s,]+/).filter(Boolean);if(!unitIds.length)return fail(`${code}: enter a unit ID.`);if(unitIds.length>20)return fail('Too many units in one command.');const seen=[...new Set(unitIds.map(x=>x.toUpperCase()))];const invalid=seen.filter(x=>!unit(x));if(invalid.length)return fail(`Unknown unit(s): ${invalid.join(', ')}.`);
 if((code==='D'||code==='DE'||code==='PRE')&&!ref)return fail(`${code}: specify the destination CFS (#4525).`);
 let target=null;if((code==='D'||code==='DE'||code==='PRE')&&ref){const r=resolve(ref);if(r.error)return fail(r.error);target=r.incident;}
 const messages=[];for(const id of seen){const u=unit(id);if(['D','DE','PRE'].includes(code)){const r=code==='PRE'?preempt(u,target):dispatchUnit(u,target,code);messages.push(r);continue;}
 if(code==='A'){const active=owner(u);if(active.length>1){messages.push(fail(`${id}: multiple assignments.`));continue}if(active.length){const x=active[0];x.units=x.units.filter(t=>t!==u.id);event(x,`COMMAND_AVAILABLE ${u.id}`);if(!x.units.length){x.status='PENDING';event(x,'INCIDENT_RETURNED_PENDING NO_DISPOSITION')}}u.status='AVAILABLE';u.location='Available';messages.push(ok(`${id} AVAILABLE`));continue;}
 const r=contextFor(u,ref);if(r.error){messages.push(fail(r.error));continue}const i=r.incident;if(code==='C'){const cleared=clearCadUnit(i,u,'','COMMAND');messages.push(cleared.ok?ok(cleared.message):fail(cleared.message));continue}if(code==='AH'&&u.discipline!=='EMS'){messages.push(fail(`${id}: AH requires an EMS unit.`));continue}const before=u.status;u.status=statusCodes[code];u.location=code==='AH'?'Hospital':i.location;recordAction(i,u,before,u.status,code);messages.push(ok(`${id}: ${before} → ${u.status} on ${i.id}.`));}
 return messages;
}
async function executeShared(raw){
 const chunks=raw.split(';').map(s=>s.trim()).filter(Boolean);
 if(chunks.length>30){results.textContent='Maximum 30 commands per batch.';return;}
 const button=document.getElementById('executeCadCommand');button.disabled=true;
 results.textContent='Processing shared CAD commands…';
 const messages=[];let contextRef='';
 try{
  for(const chunk of chunks){
   try{
    let command=chunk;
    const prefix=command.match(/^#([\w-]+)\s*:\s*(.*)$/);
    if(prefix){contextRef='#'+prefix[1];command=prefix[2];if(!command){messages.push(ok('Context set to '+contextRef));continue;}}
    const m=command.match(/^(DE|AOS|C4|OS|AH|RT|D|E|C|A|T)\b\s*(.*)$/i);
    if(!m)throw Error('Unsupported shared command: '+command+'. Use D, DE, E, OS, T, AH, A or C; RT for notes.');
    const code=m[1].toUpperCase(),rest=m[2];
    const refMatch=rest.match(/#([\w-]+)/);
    const ref=refMatch?'#'+refMatch[1]:contextRef;
    if(code==='RT'){
     if(!ref)throw Error('RT requires an incident reference, e.g. RT #4526 narrative.');
     const target=resolve(ref);if(target.error)throw Error(target.error);
     const note=rest.replace(refMatch?.[0]||'','').trim();
     if(!note)throw Error('Narrative text is required.');
     await window.cadSharedCommand('note',{incidentId:target.incident.id,text:note});
     messages.push(ok('Narrative added to '+target.incident.id));continue;
    }
    const unitIds=rest.replace(refMatch?.[0]||'','').split(/[\s,]+/).filter(Boolean);
    if(!unitIds.length)throw Error('Specify a unit.');
    for(const id of unitIds){
     const u=unit(id.toUpperCase());if(!u){messages.push(fail('Unknown unit '+id));continue;}
     const active=owner(u);
     let incident;
     if(ref){const found=resolve(ref);if(found.error){messages.push(fail(found.error));continue;}incident=found.incident;}
     else if(active.length===1)incident=active[0];
     if(!incident){messages.push(fail('Specify an assigned incident for '+u.id+' using #event.'));continue;}
     if(code==='D'||code==='DE'){
      await window.cadSharedCommand('assign',{incidentId:incident.id,unitId:u.id});
      if(code==='DE')await window.cadSharedCommand('status',{incidentId:incident.id,unitId:u.id,status:'ENROUTE'});
     }else if(code==='A'||code==='C'){
      await window.cadSharedCommand('clear',{incidentId:incident.id,unitId:u.id,disposition:'CLEARED'});
     }else{
      const status={E:'ENROUTE',OS:'ONSCENE',T:'TRANSPORTING',AH:'AT_HOSPITAL',C4:'CODE4',AOS:'AVAILABLE_ON_SCENE'}[code];
      if(!status)throw Error('Unsupported shared status: '+code);
      if(code==='AH'&&u.discipline!=='EMS')throw Error('AT HOSPITAL requires an EMS unit.');
      await window.cadSharedCommand('status',{incidentId:incident.id,unitId:u.id,status});
     }
     messages.push(ok(code+' '+u.id+' → '+incident.id));
    }
   }catch(e){messages.push(fail(chunk+': '+e.message));}
  }
 }finally{
  results.replaceChildren();
  messages.forEach((r,index)=>{const el=document.createElement('div');el.className='cad-result-line'+(r.ok?'':' error');el.textContent=(index+1)+'. '+(r.ok?'OK':'REVIEW')+': '+r.message;results.append(el);});
  button.disabled=false;
  if(messages.every(x=>x.ok))input.value='';
 }
}
function execute(){if(window.cadSharedIsActive?.()){hideSuggestions();hideGeo();void executeShared(input.value.trim());return;}hideGeo();const raw=input.value.trim();if(!raw)return;const chunks=raw.split(';').map(s=>s.trim()).filter(Boolean);if(chunks.length>30){results.textContent='Maximum 30 commands per batch.';return;}const ctx={ref:null,incident:null};const output=[];for(const chunk of chunks){try{const v=execOne(chunk,ctx);if(Array.isArray(v))output.push(...v);else if(v)output.push(v);}catch(e){output.push(fail(`Error in ${chunk}: ${e.message}`))}}results.innerHTML='';for(const [idx,r] of output.entries()){const el=document.createElement('div');el.className='cad-result-line'+(r.ok?'':' error');el.textContent=`${idx+1}. ${r.ok?'OK':'REVIEW'}: ${r.message}`;results.append(el)}save();hideSuggestions();input.value='';}
const eventToken=()=>{const pos=input.selectionStart??input.value.length;const prefix=input.value.slice(0,pos);const match=prefix.match(/#([^\s;:]*)$/);return match?{term:match[1],from:pos-match[0].length,to:pos}:null;};let currentOptions=[],hover=0;
function hideSuggestions(){sugg.hidden=true;currentOptions=[];}
function updateSuggestions(){const t=eventToken();if(!t){hideSuggestions();return}const query=t.term.toLowerCase();currentOptions=allCurrent().filter(i=>!query||[i.id,i.id.split('-').at(-1),i.type,i.location].some(s=>s.toLowerCase().includes(query))).slice(0,12);hover=0;sugg.innerHTML='';if(!currentOptions.length){hideSuggestions();return;}for(const [n,i] of currentOptions.entries()){const item=document.createElement('button');item.type='button';item.className='cad-suggestion';item.setAttribute('role','option');item.setAttribute('aria-selected',String(n===hover));const primary=document.createElement('strong');primary.textContent=`${i.id} · ${i.type}`;const secondary=document.createElement('small');secondary.textContent=`${i.location} · ${i.priority} · ${i.status}`;item.append(primary,secondary);item.onmousedown=e=>e.preventDefault();item.onclick=()=>choose(i);sugg.append(item);}sugg.hidden=false;}
function choose(i){const t=eventToken();if(!t)return;input.value=input.value.slice(0,t.from)+'#'+i.id+input.value.slice(t.to);const pos=t.from+i.id.length+1;input.focus();input.setSelectionRange(pos,pos);hideSuggestions();}
// Address discovery for text between @ markers; selected suggestion substitutes a validated address.
const geoMenu=document.createElement('div');geoMenu.id='cadGeoSuggestions';geoMenu.hidden=true;
input.parentElement.appendChild(geoMenu);
let geoTimer,geoEpoch=0;
function activeAddress(){const text=input.value,pos=input.selectionStart??text.length;const begin=text.lastIndexOf('@',pos-1);if(begin<0)return null;const end=text.indexOf('@',begin+1);if(end>=0&&pos>end)return null;const term=text.slice(begin+1,end>=0?end:pos).trim();if(!term||term.length<4)return null;return{begin,end,term}}
function hideGeo(){geoMenu.hidden=true;geoMenu.replaceChildren()}
async function lookupAddresses(){const span=activeAddress();if(!span){hideGeo();return}if(window.cadCommonPlaces?.resolve(span.term)){hideGeo();return}const epoch=++geoEpoch;
 try{const url='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q='+encodeURIComponent(span.term+', Petaluma, CA');const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw Error('Service unavailable');const matches=await res.json();if(epoch!==geoEpoch)return;hideGeo();if(!matches.length)return;
 for(const place of matches){const button=document.createElement('button');button.type='button';button.textContent=place.display_name;button.onmousedown=e=>e.preventDefault();button.onclick=()=>{const start=span.begin,finish=span.end<0?input.value.length:span.end+1;const address=place.display_name.split(',').slice(0,2).join(',').trim();input.value=input.value.slice(0,start)+'@'+address+'@'+input.value.slice(finish);const cursor=start+address.length+2;input.focus();input.setSelectionRange(cursor,cursor);hideGeo();hideSuggestions()};geoMenu.appendChild(button)}geoMenu.hidden=false;
 }catch(_){hideGeo()}}
function scheduleGeo(){clearTimeout(geoTimer);if(activeAddress())geoTimer=setTimeout(lookupAddresses,700);else hideGeo()}
input.addEventListener('input',scheduleGeo);
input.addEventListener('input',updateSuggestions);input.addEventListener('click',updateSuggestions);input.addEventListener('keydown',e=>{if(!sugg.hidden&&['ArrowUp','ArrowDown','Tab'].includes(e.key)){e.preventDefault();if(e.key==='Tab'){choose(currentOptions[hover]);return;}hover=(hover+(e.key==='ArrowDown'?1:-1)+currentOptions.length)%currentOptions.length;[...sugg.children].forEach((el,j)=>el.setAttribute('aria-selected',String(j===hover)));return;}if(e.key==='Escape'){hideSuggestions();return;}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!sugg.hidden){choose(currentOptions[hover]);return;}execute();}});document.getElementById('executeCadCommand').onclick=execute;window.cadExecuteSharedCommand=executeShared;
// Capture shared commands before any legacy CAD command listeners can mutate local state.
document.addEventListener('click',e=>{
 if(!window.cadSharedIsActive?.()||!e.target.closest('#executeCadCommand'))return;
 e.preventDefault();e.stopImmediatePropagation();
 execute();
},true);
document.addEventListener('keydown',e=>{
 if(!window.cadSharedIsActive?.()||e.target!==input||e.key!=='Enter'||e.shiftKey)return;
 if(!sugg.hidden)return; // Allow the existing incident-number autocomplete.
 e.preventDefault();e.stopImmediatePropagation();
 execute();
},true);
document.addEventListener('click',e=>{if(!e.target.closest('.cad-smart-entry'))hideSuggestions()});
function boardAnswer(text){const q=text.toLowerCase().replace(/[^\w\s-]/g,' '),pending=incidents().filter(i=>i.status==='PENDING'),active=incidents().filter(i=>i.status==='ACTIVE'),available=units().filter(u=>u.status==='AVAILABLE');
 const p1=incidents().filter(i=>i.status!=='CLOSED'&&(i.priority==='P1'||i.priority==='1')&&!i.units.length);
 if(/priority\s*(one|1)|p1|unassigned|without\s*(an?\s*)?(assigned\s*)?unit/.test(q))return p1.length?`${p1.length} unassigned priority-one call(s):\n`+p1.map(i=>`${i.id} · ${i.type} · ${i.location} (${i.status})`).join('\n'):'No unassigned priority-one incidents.';
 if(/how\s*long|over\s*\d+|longer\s*than|on\s*scene\s*\d+/.test(q)){
 const mins=Number(q.match(/(\d+)\s*(minute|min|m\b)/)?.[1]||20);
 const scene=units().filter(u=>u.status==='ONSCENE');
 const aged=scene.filter(u=>Number.isFinite(Number(u.statusChangedAt)) && Date.now()-Number(u.statusChangedAt)>=mins*60000);
 const unknown=scene.filter(u=>!Number.isFinite(Number(u.statusChangedAt)));
 const list=aged.map(u=>`${u.id} · ${owner(u)[0]?.id||'unassigned'} · ${Math.floor((Date.now()-Number(u.statusChangedAt))/60000)} min`).join('\n')||'None with confirmed elapsed time.';
 return `${aged.length} unit(s) confirmed on scene at least ${mins} minutes:\n${list}${unknown.length?'\nTiming unavailable for '+unknown.map(u=>u.id).join(', ')+' (status predates tracking).':''}`;
 }
 if(/available|free\s*units|resources/.test(q)&&!/rundown|board|overview|summary/.test(q))return `${available.length} available unit(s): ${available.map(u=>u.id+' ('+u.discipline+')').join(', ')||'none'}.`;
 if(/pending/.test(q)&&!/rundown|board|overview|summary/.test(q))return `${pending.length} pending call(s):\n`+(pending.map(i=>`${i.id} · ${i.priority} ${i.type} · ${i.location}`).join('\n')||'None');
 if(/active/.test(q)&&!/rundown|board|overview|summary/.test(q))return `${active.length} active incident(s):\n`+(active.map(i=>`${i.id} · ${i.type} · ${i.units.join(', ')||'NO UNITS'}`).join('\n')||'None');
 if(/rundown|what.*(board|happening)|board|overview|summary|sitrep|status of calls/.test(q))return `CAD board rundown (current browser):\n${pending.length} pending calls; ${active.length} active incidents; ${available.length} available units (${units().length} total).\n${p1.length} unassigned priority-one incidents.\nActive: ${active.map(i=>`${i.id} ${i.type} [${i.units.join(', ')||'no units'}]`).join('; ')||'none'}.\nPending: ${pending.map(i=>`${i.id} ${i.type} (${i.priority})`).join('; ')||'none'}.`;
 return 'I can answer: board rundown, pending calls, active incidents, available units, unassigned priority-one incidents, and on-scene units. I will not guess at operational facts or change CAD records from a question.';}
function answerQuestion(text,voice=false){const response=boardAnswer(text);answer.textContent=response;if(voice){document.getElementById('voiceHeard').textContent=text;document.getElementById('voiceInterpretation').textContent='BOARD INTELLIGENCE | '+response.replace(/\n/g,' | ');}}
window.cadAskQuestion=(question)=>{ask.value=String(question||'');if(ask.value.trim()){answerQuestion(ask.value.trim());return answer.textContent;}return '';};
function askNow(){if(ask.value.trim())answerQuestion(ask.value.trim());}document.getElementById('cadAskGo').onclick=askNow;ask.addEventListener('keydown',e=>{if(e.key==='Enter')askNow()});document.querySelectorAll('[data-cad-question]').forEach(b=>b.onclick=()=>{ask.value=b.dataset.cadQuestion;askNow()});
const previous=window.cadBeforeVoiceProcess;window.cadBeforeVoiceProcess=(text,source)=>{if(/^(?:dispatch[,]?\s*)?(?:what(?:'s| is)|which units|show me (?:all|the|any)|give me (?:a|the)|how many|do we have|are there|tell me).*(?:board|available|pending|active|priority|on.scene|incident|unit|rundown|status)/i.test(text.trim())){answerQuestion(text,true);return true;}return previous?.(text,source)===true;};
window.cadCommandTest={resolve,boardAnswer,execOne};
})();
