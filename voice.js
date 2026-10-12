/* SonoMarzi CAD Voice Intelligence: browser-only hackathon prototype. */
(()=>{
'use strict';
let newestFirst=localStorage.getItem('smcad-voice-order-v17.3')!=='oldest', activeTab='narrative', highlightId=null, recognition=null, holding=false, captured='', resultsReceived=false, session=0, demoRunning=false;
const el=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=()=>new Date().toLocaleTimeString('en-US',{hour12:false});
const speech=window.SpeechRecognition||window.webkitSpeechRecognition;
function ensure(){state.voiceActivity ||= [];state.voiceUnlinked ||= [];for(const i of state.incidents){i.radioTranscripts ||= [];i.voiceNotes ||= [];}}
function activity(msg){ensure();state.voiceActivity.unshift(`${stamp()} ${msg}`);state.voiceActivity=state.voiceActivity.slice(0,60);}
function indicator(t,recording=false){el('headerRadioIndicator').textContent=t;el('headerRadioIndicator').classList.toggle('live',recording);el('voiceIndicator').textContent=t;el('voiceIndicator').classList.toggle('recording',recording);el('voicePTT').classList.toggle('recording',recording);el('voicePTT').textContent=recording?'🔴 Transmitting… release to stop':'🎙 Hold to Talk';}
const normalize=window.CadVoiceText.normalize;
const digitNames={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20',thirty:'30',forty:'40',fifty:'50'};
function nums(s){return s.split(/\s+/).map(w=>digitNames[w]??w).join(' ').replace(/\b(20|30|40|50)\s+([1-9])\b/g,(_,t,u)=>String(Number(t)+Number(u)));}
function aliases(id){let up=id.toUpperCase(), candidates=[up.toLowerCase()]; const m=up.match(/^(\d+)([A-Z]+)(\d+)$/); if(m){let alpha=m[2]==='A'?'adam':m[2]==='B'?'boy':m[2].toLowerCase(); candidates.push(`${m[1]} ${alpha} ${m[3]}`,`${m[1]} ${m[2].toLowerCase()} ${m[3]}`,`${m[1]}${alpha}${m[3]}`);}if(/^E\d+$/.test(up))candidates.push('engine '+up.slice(1),'engine'+up.slice(1));if(/^M\d+$/.test(up))candidates.push('medic '+up.slice(1),'medic'+up.slice(1));for(const [code,name] of [['T','truck'],['B','battalion'],['R','rescue']])if(new RegExp('^'+code+'[0-9]+$').test(up))candidates.push(name+' '+up.slice(1),name+up.slice(1));if(/^SO\d+$/.test(up))candidates.push('sheriff '+up.slice(2),'s o '+up.slice(2));return candidates.map(normalize);}
function tokenized(text){return nums(normalize(text)).replace(/\b(alpha|adam)\b/g,'a').replace(/\b(bravo|boy)\b/g,'b').replace(/\b(charlie)\b/g,'c').replace(/\b(delta|david)\b/g,'d').replace(/\b(engine)\b/g,'e').replace(/\b(medic)\b/g,'m').replace(/\b(truck)\b/g,'t').replace(/\b(battalion|chief)\b/g,'b').replace(/\b(rescue)\b/g,'r').replace(/\b(sheriff|s o)\b/g,'so').replace(/\s+/g,'');}
// Shared callsign resolver for both outgoing dispatch and incoming status updates.
// Chrome frequently turns "3 Adam 21" into "321" or "three out of 21".
// Match a callsign at the beginning of the utterance, not numbers in addresses.
function leadingRadioUnit(text){
 const spoken=nums(normalize(text));
 const head=spoken.replace(/^(?:(?:dispatch(?:er)?|radio|unit)\s+){1,2}/,'');
 // Spoken phonetics and common ASR substitution ("out of" for "Adam").
 let match=head.match(/^([1-9]\d?)\s+(?:adam|alpha|a|out of|outta|addam)\s+(\d{1,3})\b/);
 if(match){
  const candidates=state.units.filter(u=>{
   const parts=u.id.toUpperCase().match(/^(\d+)A(\d+)$/);
   return parts&&parts[1]===match[1]&&parts[2]===match[2];
  });
  return candidates.length===1?candidates:null;
 }
 // A flattened numeric call sign (321 -> 3A21), only at start or after a radio prefix.
 match=head.match(/^(\d{2,5})\b/);
 if(match){
  const candidates=state.units.filter(u=>{
   const parts=u.id.toUpperCase().match(/^(\d+)[A-Z](\d+)$/);
   return parts&&parts[1]+parts[2]===match[1];
  });
  return candidates.length===1?candidates:null;
 }
 return null;
}
function unitMatches(text){
 // OpenAI can return compact phonetic callsigns like 3Adam12. Split them
 // before matching, while leaving the stored transcript untouched.
 text=String(text).replace(/(\d)(adam|alpha|boy|bravo)(?=\d)/gi,'$1 $2 ').replace(/(\d)(adam|alpha|boy|bravo)\s+(?=\d)/gi,'$1 $2 ');
 const resolvedLeading=leadingRadioUnit(text);
 // A leading call sign may be an acknowledgement before several dispatch targets.
 // Prefer all explicit phonetic call signs when more than one is present.
 const multiPhonetic=(nums(normalize(text)).match(/\b\d+\s+(?:adam|alpha|a|boy|bravo|b)\s+\d+\b/g)||[]).length>1;
 // A leading unit does not exclude additional units later in the same command.
 // Resolve it together with all other explicitly mentioned callsigns.
 // ASR often collapses "Three Adam Twenty One" to "321". Only resolve a
 // numeric callsign at the start of the spoken command, before any address.
 const lead=nums(normalize(text)).match(/^(?:(?:dispatch(?:er)?|unit|send|assign)\s+)?(\d{2,5})\b(?=\s+(?:respond|take|go|show|enroute|on|code|clear|available|dispatched|assign|to|for|and)\b)/);
 // Chrome sometimes transcribes 'three Adam twenty one' as 'three out of 21'.
 // Restrict this repair to a leading callsign in an operational utterance.
 const asrCalls = nums(normalize(text)).match(/^([1-9])\s+(?:out of|adam|alpha|a)\s+(\d{1,3})\b(?=\s+(?:respond|take|go|show|enroute|on|code|clear|available|dispatched|assign|to|for|and)\b)/);
 const flattened=lead?.[1] || (asrCalls ? asrCalls[1]+asrCalls[2] : null);
 const numericCandidates=flattened ? state.units.filter(u=>{
  const m=u.id.toUpperCase().match(/^(\d+)[A-Z](\d+)$/);
  return m && m[1]+m[2]===flattened;
 }) : [];
 if(numericCandidates.length===1 && !/\b(?:and|&)\b/i.test(text))return numericCandidates;
 const speechText=nums(normalize(text));
 const words=speechText.split(/\s+/).filter(Boolean);
 const joined=tokenized(text);
 const compact=nums(normalize(text)).replace(/\b(adam|alpha)\b/g,'a').replace(/\b(boy|bravo)\b/g,'b').replace(/\s+/g,'');
 return state.units.filter(u=>{
   if(resolvedLeading?.some(x=>x.id===u.id))return true;
   const target=u.id.toLowerCase();
   // Numeric-radio callsigns are matched by spoken component sequences, not arbitrary substrings.
   const numeric=target.match(/^(\d+)([a-z]+)(\d+)$/);
   if(numeric){
     const [_,prefix,letter,suffix]=numeric;
     const prefixAliases=[prefix],letterAliases=letter==='a'?['a','adam','alpha']:letter==='b'?['b','boy','bravo']:[letter],suffixAliases=[suffix];
     for(let i=0;i<words.length;i++){
       if(!prefixAliases.includes(words[i]))continue;
       for(const middle of letterAliases){
         if(words[i+1]===middle && suffixAliases.includes(words[i+2]))return true;
         if(words[i+1]===middle+suffix)return true;
       }
     }
   }
   const short=target.match(/^([a-z]+)(\d+)$/);if(short){const names=short[1]==='e'?['e','engine']:short[1]==='m'?['m','medic']:short[1]==='t'?['t','truck']:short[1]==='b'?['b','battalion','battalion chief']:short[1]==='r'?['r','rescue']:short[1]==='so'?['so','sheriff']: [short[1]];if(words.some((w,i)=>names.includes(w)&&words[i+1]===short[2]))return true;}
   if(words.includes(target))return true;
   // Speech engines commonly render 3A21 as '3 A 21', '3 Adam 21', '3a 21', or 'three a twenty one'.
   const canonical=nums(normalize(text)).replace(/\b(adam|alpha)\b/g,'a').replace(/\b(boy|bravo)\b/g,'b');
   const normalizedId=target.replace(/[^a-z0-9]/g,'');
   if(new RegExp('(?:^|[^a-z0-9])'+normalizedId+'(?:$|[^a-z0-9])','i').test(canonical.replace(/(\d+)\s+([a-z])\s+(\d+)/g,'$1$2$3')))return true;
   if(compact.includes(normalizedId) && (compact===normalizedId || new RegExp('(?:^|[^a-z0-9])'+normalizedId+'(?=[a-z]|$)','i').test(canonical.replace(/\s+/g,''))))return true;
   // Only match a full token, never a substring of another callsign.
   return new RegExp('(?:^|[^a-z0-9])'+target+'(?=$|[^a-z0-9])','i').test(normalize(text)) || joined===target || new RegExp('(?:^|\\b)'+target+'(?:\\b|$)','i').test(joined);
 });
}
function normalizeRadioStatus(text){
 // Only interpret the normalized copy. Radio transcripts always retain ASR's original words.
 return normalize(text)
  .replace(/\b(?:in|on)\s+route\b/g,'enroute')
  .replace(/\ben\s+route\b/g,'enroute')
  .replace(/\b(?:in|on)\s+root\b/g,'enroute')
  .replace(/\bcode\s+four\b/g,'code 4')
  .replace(/\b(on|at)\s+the\s+scene\b/g,'on scene');
}
function parseStatus(text){const t=normalizeRadioStatus(text);if(/\b(not|never|don't|do not|cancel)\b/.test(t))return {status:null,reason:'Negated or cancelled instruction, review required'};
if(/\b(preempt|preempted|break from assignment|close (the )?(call|incident|event))\b/.test(t))return {status:null,reason:'Sensitive workflow requested: dispatcher confirmation required'};
if(/\b(clear(?:ed)? with disposition|clear(?:ed)? disposition)\b/.test(t))return {status:'CLEAR', dispositionRequired:true,reason:'Disposition requires dispatcher confirmation'};
if(/\b(code four|code 4)\b/.test(t))return {status:'CODE4'};
if(/\b(available on scene|available at scene|available on location)\b/.test(t))return {status:'AVAILABLE_ON_SCENE'};
if(/\b(clear|cleared|10\s*8|ten eight)\b/.test(t))return {status:'CLEAR'};
if(/\b(on scene|onscene|at scene|arrived|10\s*97|ten ninety seven)\b/.test(t))return {status:'ONSCENE'};
if(/\b(en\s?route|responding|on the way|10\s*76|ten seventy six)\b/.test(t))return {status:'ENROUTE'};
if(/\b(dispatched|respond to|send (out|over)|assign)\b/.test(t))return {status:'DISPATCHED'};
if(/\b(out of service|10\s*7|ten seven)\b/.test(t))return {status:'OUT_OF_SERVICE'};
if(/\b(available|back in service)\b/.test(t))return {status:'AVAILABLE'};
return {status:null,reason:'No status command detected'};}
function details(text){
 const t=normalize(text), parts=[];
 const add=x=>{if(x&&!parts.includes(x))parts.push(x)};
 const numberWords={one:'One',two:'Two',three:'Three',four:'Four',five:'Five',six:'Six'};
 const subj=t.match(/\b(one|two|three|four|five|six|[1-9])\s+(subjects?|suspects?|persons?|people)\b/);
 const n=subj?(numberWords[subj[1]]||subj[1]):null;
 const subjects=n?`${n} ${/^(one|1)$/i.test(subj[1])?'subject':'subjects'}`:'Subject';
 const flight=/\b(running|fleeing|ran|on foot|foot pursuit)\b/.test(t);
 if(subj){
  const movement=flight?' running':/\b(outside)\b/.test(t)?' outside':'';
  add(subjects+movement);
 }else if(flight){add('Subject '+(/\b(running)\b/.test(t)?'running': 'fleeing on foot'));}
 const dir=t.match(/\b(northbound|southbound|eastbound|westbound|north|south|east|west|nb|sb|eb|wb)\b/);
 if(dir){
  const names={nb:'northbound',sb:'southbound',eb:'eastbound',wb:'westbound'};
  const direction=names[dir[1]]||dir[1];
  const tail=t.slice(dir.index+dir[0].length);
  const street=tail.match(/^\s+(?:on|down|along|toward|towards)\s+(.+?)(?=\s+(?:wearing|with|approximately|about|subject|suspect|one|two|send|start|request|and|i(?:'m| am)|we|he|she|they|unit|backup|black|white|hispanic|asian)\b|$)/);
  add('Direction of travel: '+direction+(street?' on '+street[1].trim():''));
 }
 const person=t.match(/\b(white|black|hispanic|asian)\s+(male|female)\b|\b(male|female)\b/);
 if(person){
  const personDescription=[person[1],person[2]||person[3],/\b(adult|juvenile|teenager|teen|child)\b/.exec(t)?.[1]].filter(Boolean);
  add('Description: '+personDescription.join(' '));
 }else{
  const ageOnly=/\b(adult|juvenile|teenager|teen|child)\b/.exec(t);
  if(ageOnly)add('Subject described as '+ageOnly[1]);
 }
 // Preserve statements of reported age when stated explicitly, but never infer one.
 const years=t.match(/\b(?:approximately |approx |about |around )?(\d{1,2})\s*(?:years? old|year old|yoa|y\/?o)\b/);
 if(years)add('Age reported: '+years[1]);
 const height=t.match(/\b(?:approximately|approx|about|around)?\s*(\d|one|two|three|four|five|six|seven)\s*(?:feet|foot|ft)\s*(?:(\d{1,2})\s*(?:inches|inch|in)?)?\b|\b(\d)\s*foot\s*(\d{1,2})\b/);
 if(height)add('Height reported: '+({one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7'}[height[1]||height[3]]||height[1]||height[3])+' ft'+(height[2]||height[4]?' '+(height[2]||height[4])+' in':''));
 const clothing=t.match(/\b(?:wearing|wears|has on|dressed in)\s+((?:(?:a|an)\s+)?(?:(?:black|white|red|blue|gray|grey|green|brown|dark|light)\s+)?(?:hoodie|jacket|shirt|sweatshirt|coat|pants|shorts|hat|cap|jeans)(?:\s+(?:and|with)\s+(?:(?:black|white|red|blue|gray|grey|green|brown)\s+)?(?:pants|shorts|jeans|hat|cap))?)/);
 if(clothing)add('Clothing: '+clothing[1]);else {const bare=t.match(/\b(black|white|red|blue|gray|grey|green|brown|dark|light)\s+(hoodie|jacket|shirt|sweatshirt|coat|pants|shorts|hat|cap|jeans)\b/);if(bare)add('Clothing: '+bare[0]);}
 if(/\b(one|1|a)\s+(subject|suspect|person)\s+(?:is\s+|was\s+)?detained\b|\b(one|1)\s+detained\b|\b(subject|suspect|person)\s+(?:is\s+|was\s+)?in custody\b/.test(t))add('One subject detained');
 else if(/\b(subject|suspect|person)\s+(?:is\s+|was\s+)?detained\b|\bin custody\b/.test(t))add('Subject detained');
 if(/\b(send|start|request|need|can i get|get me)\b.{0,30}\b(another unit|additional unit|backup|cover unit|second unit)\b|\b(need|requesting)\s+(backup|cover)\b/.test(t))add('Additional unit requested');
 // A spoken routing request is operational radio traffic even without a status change.
 const route=t.match(/\b(?:show me|give me|need|request|send me|can i get)\s+(?:a |the )?(?:route|directions|routing)\s+to\s+(?:the )?(.+?)(?=\s+(?:please|copy|over|thanks|thank you|and then)\b|$)/);
 if(route)add('Routing requested to '+route[1].trim());
 // Capture explicitly mentioned alarms without turning them into status commands.
 if(!route && /\b(?:responding to|going to|headed to)\s+(?:an? |the )?alarm\b/.test(t))add('Alarm response mentioned');
 if(/\b(gun|firearm|knife|weapon)\b/.test(t))add('Weapon mentioned; verify context in source transmission');
 if(/\b(injur\w*|medical aid|ambulance|paramedics)\b/.test(t))add('Medical or injury information mentioned; verify source transmission');
 return parts;
}
// Use the selected event to resolve speech-to-text dropping the phonetic letter, e.g. "321" for "3 Adam 21".
// Never infer a callsign when more than one active assigned unit fits the numbers.
function contextUnits(text, matches){
 if(matches.length)return {units:matches, resolution:'explicit'};
 const selected=state.incidents.find(i=>i.id===state.selected && i.status==='ACTIVE');
 if(!selected)return {units:[],resolution:'none'};
 const candidates=state.units.filter(u=>selected.units.includes(u.id));
 const t=nums(normalize(text)).replace(/\b(three|two|one)\b/g,w=>({three:'3',two:'2',one:'1'}[w]));
 const tokens=t.match(/\b\d+\b/g)||[];
 // The start of a transmission is normally the callsign. Chrome can hear 3A21 as '321'.
 const leadingNumeric=t.match(/^\s*(\d{2,6})(?=\s|$|[,.:])/);
 if(leadingNumeric && !tokens.includes(leadingNumeric[1]))tokens.unshift(leadingNumeric[1]);
 const inferred=candidates.filter(u=>{
  const m=u.id.toUpperCase().match(/^(\d+)[A-Z]+(\d+)$/);
  if(!m)return false;
  const concatenated=m[1]+m[2];
  return tokens.includes(concatenated) || new RegExp('(?:^|\\W)'+m[1]+'\\s+'+m[2]+'(?=$|\\W)').test(t);
 });
 return inferred.length===1?{units:inferred,resolution:'contextual'}:{units:[],resolution:inferred.length>1?'ambiguous':'none'};
}
function association(units,source,status){
 const selected=state.incidents.find(i=>i.id===state.selected && i.status!=='CLOSED');
 const assigned=state.incidents.filter(i=>i.status==='ACTIVE'&&units.some(u=>i.units.includes(u.id)));
 // An explicitly selected event wins when the identified unit is assigned to that event.
 if(selected && units.some(u=>selected.units.includes(u.id)))return selected;
 // Dispatching an available unit to the selected event should not attach to an old call.
 if(selected && source==='DISPATCH' && status==='DISPATCHED' && units.every(u=>!assigned.some(i=>i.units.includes(u.id))))return selected;
 if(assigned.length===1)return assigned[0];
 // Unidentified speech still logs to an explicitly selected incident, never changes a unit.
 if(selected && !units.length)return selected;
 // Identified unit unassigned everywhere: log to selected event without altering status.
 if(selected && assigned.length===0)return selected;
 return null;
}
function process(text,source=el('voiceSource').value){text=String(text||'').trim();if(!text){indicator('READY');return;}ensure();const match=contextUnits(text,unitMatches(text)),units=match.units,parsed=parseStatus(window.CadRadioStatusRepair.repair(text,match.resolution==='explicit'&&units.length===1));const selectedActive=state.incidents.find(i=>i.id===state.selected&&i.status==='ACTIVE');const inc=association(units,source,parsed.status)||(!units.length?selectedActive:null);const tid='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);const record={id:tid,time:stamp(),source,text,units:units.map(x=>x.id),status:parsed.status,incidentId:inc?.id||null};const actions=[];const blockers=[];const observed=units.map(u=>u.id).join(', ')||'NONE';
if(!units.length)blockers.push(match.resolution==='ambiguous'?'Multiple assigned units match spoken digits. Confirm unit.':'Unit not identified. No status update applied. Check recognized words against unit IDs.');if(units.length&&!inc)blockers.push('No unique associated active incident for '+observed);if(parsed.reason)blockers.push(parsed.reason);if(!parsed.status){const incomplete=window.CadRadioIncomplete.inspect(text,match.resolution==='explicit'&&units.length===1);if(incomplete)blockers.push(incomplete.reason);}
if(inc){inc.radioTranscripts.push(record);event(inc,`RADIO_${source==='FIELD'?'RX':'TX'} ${units.map(u=>u.id).join(', ')||'UNIDENTIFIED'}: ${text} [transcript:${tid}]`);const descriptors=details(text);if(parsed.status&&units.length&&!parsed.dispositionRequired){for(const u of units){const already=inc.units.includes(u.id);if(!already && !(source==='DISPATCH'&&parsed.status==='DISPATCHED')){blockers.push(`${u.id} not assigned to event`);continue;}if(!already){inc.units.push(u.id);inc.status='ACTIVE';event(inc,`VOICE_UNIT_ASSIGNED ${u.id}`);}const prev=u.status;const allowed={AVAILABLE:['DISPATCHED','ONSCENE','ENROUTE','OUT_OF_SERVICE'],CLEAR:['DISPATCHED','ENROUTE','ONSCENE','AVAILABLE'],DISPATCHED:['ENROUTE','ONSCENE','AVAILABLE','CLEAR'],ENROUTE:['ONSCENE','AVAILABLE','CLEAR'],ONSCENE:['CODE4','AVAILABLE_ON_SCENE','CLEAR','AVAILABLE'],CODE4:['ONSCENE','AVAILABLE_ON_SCENE','CLEAR'],AVAILABLE_ON_SCENE:['ONSCENE','CODE4','CLEAR'],TRANSPORTING:['AVAILABLE','ONSCENE','CLEAR'],OUT_OF_SERVICE:['AVAILABLE']};if(prev!==parsed.status && !(allowed[prev]||[]).includes(parsed.status)){blockers.push(`${u.id} status transition ${prev} → ${parsed.status} requires manual review`);continue;}if(prev!==parsed.status){u.status=parsed.status;if(parsed.status==='AVAILABLE'||parsed.status==='CLEAR'){u.location='Available';if(parsed.status==='CLEAR')inc.units=inc.units.filter(id=>id!==u.id);}else u.location=inc.location;actions.push(`${u.id} ${prev} → ${u.status}`);event(inc,`VOICE_STATUS ${u.id} ${prev} -> ${u.status} transcript:${tid}`);}}}
// Event narratives describe radio content, not backend status transitions. Those belong in Event History.
const summaryPieces=[];
const statusWording={ONSCENE:'on scene',ENROUTE:'enroute',DISPATCHED:'dispatched',AVAILABLE:'clear and available',OUT_OF_SERVICE:'out of service',CODE4:'code 4',AVAILABLE_ON_SCENE:'available on scene',CLEAR:'clear'};
const mentionedIds=units.filter(u=>inc.units.includes(u.id)).map(u=>u.id);
const operationalDescriptors=descriptors.map(d=>d.charAt(0).toUpperCase()+d.slice(1));
if(parsed.status && mentionedIds.length){
 const statusText=statusWording[parsed.status]||parsed.status.toLowerCase();
 // Do not imply a status transition when one was blocked; accurately retain the radio report.
 const blocked=blockers.some(x=>/status transition|not assigned to event/.test(x));
 summaryPieces.push(`${mentionedIds.join(', ')} reported ${statusText}`);
}
summaryPieces.push(...operationalDescriptors);
if(summaryPieces.length){
 const s=summaryPieces.map(x=>x.replace(/[.; ]+$/,'')).join('. ')+'.';
 const note={id:tid,time:record.time,summary:s,source:units.length===1?units[0].id:source,method:'rule-based'};
 inc.voiceNotes.push(note);inc.narrative.push(`${record.time} [Radio summary] ${s}`);
 event(inc,`RADIO_SUMMARY transcript:${tid}`);
  requestAISummary(inc.id,tid,text,note.source,inc.type,inc.location);
}else if(!parsed.status && !descriptors.length){blockers.push('Transcript saved. Local rules found no summary');requestAISummary(inc.id,tid,text,units.length===1?units[0].id:source,inc.type,inc.location);}
}else{state.voiceUnlinked.push(record);}
if(inc && blockers.length)event(inc,`VOICE_REVIEW ${blockers.join(' | ').slice(0,240)} transcript:${tid}`);
const rec=inc&&!blockers.some(b=>/not assigned|transition|no unique/i.test(b))?window.cadIncidentIntelligence?.apply(inc,window.cadIncidentIntelligence.classification(text),text,source+' RADIO'):null;
if(rec?.applied)actions.push(rec.applied);
if(rec?.review)blockers.push(rec.review);
const log=`${source==='FIELD'?'RX':'TX'} | ${units.map(u=>u.id).join(', ')||'Unknown unit'} | ${inc?.id||'Unlinked'} | ${actions.join('; ')||blockers.join('; ')||'Transcript logged'}`;activity(log);el('voiceHeard').textContent=text;el('voiceInterpretation').textContent=`HEARD: ${text} | UNIT: ${observed} (${match.resolution}) | EVENT: ${inc?.id||'unresolved'} | REQUEST: ${parsed.status||'none'} | ${blockers.length?'REVIEW: '+blockers.join('; '):'APPLIED: '+(actions.join('; ')||'Radio narrative logged')}`;save();renderActivity();if(inc){state.selected=inc.id;activeTab='narrative';renderDetail();}indicator(blockers.length?'REVIEW':'PROCESSED');}
// AI only edits narrative summaries; it never dispatches units, changes statuses or closes incidents.
async function requestAISummary(incidentId, transcriptId, originalText, speaker, incidentType, location){
 const record=state.incidents.find(i=>i.id===incidentId)?.radioTranscripts?.find(r=>r.id===transcriptId);
 if(!record)return;
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
  let response;
  try{response=await fetch('/.netlify/functions/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript:originalText,speaker,incidentType,location}),signal:controller.signal});}
  finally{clearTimeout(timer);}
  if(!response.ok)throw new Error('AI summary unavailable ('+response.status+')');
  const data=await response.json();if(!data.summary||typeof data.summary!=='string')throw new Error('Missing AI summary');
  const incident=state.incidents.find(i=>i.id===incidentId);if(!incident)return;
  let note=incident.voiceNotes?.find(n=>n.id===transcriptId);
  if(note){note.summary=data.summary;note.method='ai';note.uncertainties=data.uncertainties||[];}
  else{note={id:transcriptId,time:record.time,summary:data.summary,source:speaker,method:'ai',uncertainties:data.uncertainties||[]};incident.voiceNotes.push(note);}
  // voiceNotes holds the authoritative generated summary. Leave manual incident notes intact.
  event(incident,`AI_SUMMARY transcript:${transcriptId}`);
  save();if(state.selected===incidentId)renderDetail();
 }catch(e){activity(`AI fallback | ${e.message} | transcript:${transcriptId}`);renderActivity();}
}
function renderActivity(){ensure();el('voiceActivity').innerHTML=state.voiceActivity.slice(0,7).map(x=>`<div>${safe(x)}</div>`).join('')||'<div class="muted">No radio traffic processed yet.</div>';}

// Incident selection is explicit for the radio console and synced with the main CAD incident selection.
function refreshRadioIncidents(){
 const select=el('radioIncident');if(!select)return;
 const active=state.incidents.filter(i=>i.status==='ACTIVE'||i.status==='PENDING');
 const existing=select.value;
 select.innerHTML='<option value="">Select incident...</option>'+active.map(i=>`<option value="${safe(i.id)}">${safe(i.id)} | ${safe(i.type)} | ${safe(i.location)}</option>`).join('');
 if(active.some(i=>i.id===state.selected))select.value=state.selected;
 else if(active.some(i=>i.id===existing))select.value=existing;
 else select.value='';
}
el('radioIncident').addEventListener('change',()=>{
 const id=el('radioIncident').value;state.selected=id||null;save();
 if(id)el('voiceInterpretation').textContent='Radio event selected: '+id+'. Incoming and outgoing traffic will be linked to this event when appropriate.';
});
const originalCadRender=render;render=function(){originalCadRender();refreshRadioIncidents();};
refreshRadioIncidents();
window.voiceDetailHtml=i=>{
 ensure();
 const notes=i.voiceNotes||[],trans=i.radioTranscripts||[];
 const original=(i.narrative||[]).filter(x=>!x.includes('[Radio summary]'));
 // Stored data stays chronological. Display order is purely a browser preference.
 const orderedNotes=newestFirst?[...notes].reverse():[...notes];
 const orderedTrans=newestFirst?[...trans].reverse():[...trans];
 const narrativeItems=[...original.map(t=>({type:'original',text:t})),...orderedNotes.map(n=>({type:'summary',note:n}))];
 if(newestFirst)narrativeItems.splice(0,narrativeItems.length,...orderedNotes.map(n=>({type:'summary',note:n})),...original.slice().reverse().map(t=>({type:'original',text:t})));
 const narrativeHtml=narrativeItems.map(item=>item.type==='original'?`<div class="narr">${safe(item.text)}</div>`:`<div class="voice-entry"><div class="meta">${safe(item.note.time)} | ${safe(item.note.source)} | ${item.note.method==='ai'?'AI summary':'Local summary'}</div>${safe(item.note.summary)}${item.note.uncertainties?.length?` <span class="meta">[Check: ${safe(item.note.uncertainties.join('; '))}]</span>`:''} <button data-transcript-ref="${safe(item.note.id)}">Source transcript ↗</button></div>`).join('')||'<div class="narr muted">No narrative yet.</div>';
 const transcriptHtml=orderedTrans.map(r=>`<div class="voice-entry ${highlightId===r.id?'highlight':''}" data-transcript-id="${safe(r.id)}"><div class="meta">${safe(r.time)} | ${r.source==='FIELD'?'Incoming':'Outgoing'} | ${safe((r.units||[]).join(', ')||'Unidentified')}</div>${safe(r.text)}</div>`).join('')||'<div class="narr muted">No radio transmissions linked to this event.</div>';
 return `<div class="voice-log-count">Radio records linked to this event: <strong>${trans.length}</strong> | Summaries: <strong>${notes.length}</strong></div><div class="voice-tabs"><button data-voice-tab="narrative" class="${activeTab==='narrative'?'active':''}">Event Narrative (${notes.length} radio summaries)</button><button data-voice-tab="transcript" class="${activeTab==='transcript'?'active':''}">Radio Transcript (${trans.length})</button><label class="voice-order-label" title="Choose whether the most recent entries appear first or last">Order: <select id="voiceEntryOrder"><option value="newest" ${newestFirst?'selected':''}>Newest on top</option><option value="oldest" ${!newestFirst?'selected':''}>Newest on bottom</option></select></label></div><div class="voice-detail-content" tabindex="0" role="region" aria-label="${activeTab==='narrative'?'Event narrative':'Radio transcript'}">${activeTab==='narrative'?narrativeHtml:transcriptHtml}</div>`;
};
window.voiceBindDetail=i=>{
 document.querySelectorAll('[data-voice-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.voiceTab;highlightId=null;renderDetail();});
 const order=document.getElementById('voiceEntryOrder');if(order)order.onchange=()=>{newestFirst=order.value==='newest';localStorage.setItem('smcad-voice-order-v17.3',newestFirst?'newest':'oldest');renderDetail();};
 document.querySelectorAll('[data-transcript-ref]').forEach(b=>b.onclick=()=>{activeTab='transcript';highlightId=b.dataset.transcriptRef;renderDetail();document.querySelector('.voice-entry.highlight')?.scrollIntoView({block:'nearest'});});
};
// PTT captures actual audio for OpenAI transcription. Chrome recognition runs only as
// a fallback candidate and cannot modify CAD until the server transcription fails.
let recorder=null, microphone=null, chunks=[], browserFinal='', browserInterim='', fallbackRecognition=null;
let audioSession=0, releasing=false, apiPending=false, captureStarting=false, captureFailed=false;
const maxAudioMs=30000;
function supportedAudioType(){
 const choices=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
 return choices.find(t=>window.MediaRecorder?.isTypeSupported(t))||'';
}
function chromeFallback(id){
 if(!speech)return;
 try{
  const engine=new speech();fallbackRecognition=engine;engine.lang='en-US';engine.continuous=true;engine.interimResults=true;
  engine.onresult=e=>{if(id!==audioSession)return;const finalParts=[], interimParts=[];for(let n=0;n<e.results.length;n++){const t=e.results[n]?.[0]?.transcript?.trim();if(t)(e.results[n].isFinal?finalParts:interimParts).push(t);}browserFinal=finalParts.join(' ').trim();browserInterim=interimParts.join(' ').trim();};
  engine.onerror=()=>{};engine.onend=()=>{if(fallbackRecognition===engine)fallbackRecognition=null;};engine.start();
 }catch{fallbackRecognition=null;}
}
function releaseMicrophone(){
 if(microphone){microphone.getTracks().forEach(t=>t.stop());microphone=null;}
}
function useChromeFallback(id,reason){
 if(id!==audioSession)return;
 const text=(browserFinal||browserInterim).trim();
 if(text){activity('OpenAI transcription unavailable: '+reason+'; using Chrome fallback');renderActivity();process(text);}
 else{indicator('REVIEW');el('voiceInterpretation').textContent='Audio transcription unavailable ('+reason+'). Chrome did not capture usable text. Try again or use typed fallback.';}
}
async function transcribeAudio(id,blob){
 if(id!==audioSession)return;
 apiPending=true;el('voiceInterpretation').textContent='Transcribing radio audio securely through OpenAI…';indicator('TRANSCRIBING');
 try{
  if(blob.size<150)throw new Error('Recording too short');
  if(blob.size>3_500_000)throw new Error('Recording exceeded maximum size');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  let response;try{response=await fetch('/.netlify/functions/transcribe',{method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob,signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();if(typeof data.text!=='string'||!data.text.trim())throw new Error('Empty transcript');
  if(id!==audioSession)return;
  // This is the only automatic commit path on successful audio transcription.
  process(data.text.trim());
 }catch(err){useChromeFallback(id,err.message||'network error');}
 finally{apiPending=false;}
}
async function start(){
 if(holding||captureStarting||apiPending)return;
 const id=++audioSession;holding=true;releasing=false;captureStarting=true;captureFailed=false;chunks=[];browserFinal='';browserInterim='';
 indicator('RECORDING',true);el('voiceHeard').textContent='Recording radio audio…';el('voiceInterpretation').textContent='Recording for secure transcription (release to process).';
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Audio recording unavailable in browser');
  microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  if(id!==audioSession){releaseMicrophone();return;}
  const mimeType=supportedAudioType();recorder=new MediaRecorder(microphone,mimeType?{mimeType}:{});
  const activeRecorder=recorder;
  activeRecorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  activeRecorder.onstop=()=>{if(id!==audioSession)return;releaseMicrophone();const blob=new Blob(chunks,{type:activeRecorder.mimeType||'audio/webm'});transcribeAudio(id,blob);};
  activeRecorder.onerror=()=>{captureFailed=true;};
  activeRecorder.start();chromeFallback(id);
  if(releasing)setTimeout(()=>stopRecorder(id),350);
  setTimeout(()=>{if(id===audioSession&&holding)stop();},maxAudioMs);
 }catch(e){releaseMicrophone();captureFailed=true;holding=false;indicator('REVIEW');el('voiceInterpretation').textContent='Microphone capture failed: '+e.message+'. Use typed fallback.';}
 finally{captureStarting=false;}
}
function stopRecorder(id){
 if(id!==audioSession)return;
 if(fallbackRecognition){try{fallbackRecognition.stop();}catch{}fallbackRecognition=null;}
 if(recorder?.state==='recording'){try{recorder.stop();}catch{useChromeFallback(id,'Recorder stop failed');}}
 else if(!captureStarting){releaseMicrophone();useChromeFallback(id,'No recorded audio');}
}
function stop(){
 if(!holding)return;
 holding=false;releasing=true;indicator('PROCESSING');
 const id=audioSession;
 if(!captureStarting)setTimeout(()=>stopRecorder(id),350);
}
const ptt=el('voicePTT');ptt.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();ptt.setPointerCapture?.(e.pointerId);start();});ptt.addEventListener('pointerup',e=>{e.preventDefault();stop();});ptt.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);ptt.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start();}});ptt.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();stop();}});
el('voiceSubmit').onclick=()=>{process(el('voiceManual').value);el('voiceManual').value='';};el('voiceManual').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el('voiceSubmit').click();}};
el('voiceReset').onclick=()=>{if(!confirm('Clear the voice transcripts and generated summaries from this demo?'))return;ensure();state.voiceActivity=[];state.voiceUnlinked=[];for(const i of state.incidents){i.radioTranscripts=[];i.voiceNotes=[];i.narrative=i.narrative.filter(n=>!n.includes('[Radio summary]'));}save();renderActivity();el('voiceInterpretation').textContent='Voice history cleared. Existing CAD statuses remain unchanged.';};
el('voiceDemo').onclick=()=>{if(demoRunning)return;demoRunning=true;let i=state.incidents.find(i=>i.id==='26-004518');state.selected=i.id;const u=state.units.find(u=>u.id==='3A21');u.status='DISPATCHED';save();show('dispatch');const examples=[['DISPATCH','Three Adam Twenty One, show me enroute'],['FIELD','Three Adam Twenty One on scene. Two subjects outside.'],['FIELD','Three Adam Twenty One, one subject detained, start me another unit']];el('voiceInterpretation').textContent='Playing three scripted transmissions';examples.forEach(([src,words],j)=>setTimeout(()=>{el('voiceSource').value=src;process(words,src);if(j===examples.length-1)demoRunning=false;},j*1800));};

// Voice dispatch desk: resolve the intended *pending or active* event before applying assignments.
// The AI summarizer never selects incidents or changes operational state.
function dispatchIntent(text,source){
 const t=normalize(text);
 return source==='DISPATCH' && /\b(preempt|respond(?: to| for)?|take the call|take (the )?event|assign|dispatch|send (?:units?|officers?|3|three)|start (?:units?|officers?|engine|medic|truck|battalion|rescue|[emtbr]\d+)|take (?:a |the )?unwanted|go to)\b/.test(t)
   && !/\b(never|do not|don't|cancel|disregard|hold off)\b/.test(t);
}
function addressTokens(s){return normalize(s).replace(/\b(street|st)\b/g,'st').replace(/\b(avenue|ave)\b/g,'ave').replace(/\b(road|rd)\b/g,'rd').replace(/\b(boulevard|blvd)\b/g,'blvd').replace(/\b(drive|dr)\b/g,'dr').replace(/\b(place|pl)\b/g,'pl').replace(/\b(north|south|east|west)\b/g,x=>x).trim();}
function matchDispatchIncident(text){
 const open=state.incidents.filter(i=>i.status==='PENDING'||i.status==='ACTIVE');
 const referenced=String(text).match(/(?:to|at|for)\s+(?:the\s+)?(engine|medic|truck|battalion|rescue)\s+(\d+|one|two|three|four|five|six)(?:'s)?\s+(?:location|scene|incident|call)/i);
 if(referenced){const matches=unitMatches(referenced[0]);if(matches.length===1){const owned=open.filter(i=>i.units.includes(matches[0].id));if(owned.length===1)return {incident:owned[0],reason:'assigned unit location'};}}
 const explicit=window.cadIncidentIntelligence?.resolveIncident(text,[]);
 if(explicit)return {incident:explicit,reason:'event number or unique full address'};
 const lower=normalize(text),addr=addressTokens(text);
 // Event ID must be explicitly referred to and is never inferred from the selected incident.
 const idMatches=[];
 for(const i of open){
  const compact=i.id.replace(/\D/g,'');
  const eventNum=i.id.replace(/^\d{2}-0*/,'');
  if(new RegExp('\\b(?:event|incident|call|cad|case|number|#)\\s*(?:number|#)?\\s*(?:'+i.id.replace('-','[- ]?')+'|'+compact+'|'+eventNum+')\\b','i').test(text))idMatches.push(i);
 }
 if(idMatches.length)return {incident:idMatches.length===1?idMatches[0]:null,reason:idMatches.length===1?'event number':'multiple event numbers'};
 // Prefer complete address + incident type. Require exactly one candidate at each confidence tier.
 const scored=open.map(i=>{
  const loc=addressTokens(i.location),type=normalize(i.type),parts=loc.split(' ').filter(Boolean);
  const house=parts.find(w=>/^\d+[a-z]?$/.test(w));
  const street=parts.filter(w=>w!==house&&w!=='st'&&w!=='rd'&&w!=='ave'&&w!=='blvd'&&w!=='dr'&&w!=='pl');
  const houseMatch=house?new RegExp('(?:^|\\s)'+house+'(?=\\s|$)').test(addr):false;
  const streetMatch=street.length>0 && street.every(w=>addr.split(' ').includes(w));
  const fullAddress=(house?houseMatch:true)&&streetMatch;
  const typeTokens=type.split(' ').filter(w=>w.length>2);
  const mapped=window.cadIncidentIntelligence?.classification('confirmed '+text);
  const typeMatch=(mapped?.type===i.type)|| (typeTokens.length>0&&typeTokens.every(w=>lower.split(' ').includes(w)));
  return {incident:i,fullAddress,streetMatch,typeMatch,rank:fullAddress&&typeMatch?4:fullAddress?3:streetMatch&&typeMatch?2:typeMatch?1:0};
 }).filter(x=>x.rank>0);
 if(!scored.length)return {incident:null,reason:'no matching event type or location'};
 const best=Math.max(...scored.map(x=>x.rank));const picks=scored.filter(x=>x.rank===best);
 // Type alone is only acceptable if unique and caller referred to a call type.
 if(picks.length!==1)return {incident:null,reason:'ambiguous event: '+picks.map(x=>x.incident.id).join(', ')};
 return {incident:picks[0].incident,reason:best===4?'incident type and full address':best===3?'full address':best===2?'incident type and street':'unique incident type'};
}
function processDispatch(text,source){
 const found=matchDispatchIncident(text);
 let units=unitMatches(text);
 // The first callsign in an acknowledgment/request for backup names the
 // requesting officer, not an additional resource to dispatch.
 if(/\b(?:requesting|requested|needs?|asking for)\s+(?:an?\s+)?(?:additional|more|backup)\s+(?:units?|officers?|resources?)\b/i.test(text) && units.length>1){
   const acknowledgement=text.match(/^\s*\d+\s*(?:adam|alpha|a)\s*\d+/i);
   if(acknowledgement){const requester=unitMatches(acknowledgement[0]);if(requester.length===1)units=units.filter(u=>u.id!==requester[0].id);}
 }
 const destinationReference=String(text).match(/(?:to|at|for)\s+(?:the\s+)?(?:engine|medic|truck|battalion|rescue)\s+(?:\d+|one|two|three|four|five|six)(?:'s)?\s+(?:location|scene|incident|call)/i);
 if(destinationReference){const referring=unitMatches(destinationReference[0]);if(referring.length===1)units=units.filter(u=>u.id!==referring[0].id);}
 const preempt=/\bpreempt\b/i.test(text);
 const blockers=[];let inc=found.incident;
 if(!inc)blockers.push('Event not resolved: '+found.reason);
 if(!units.length)blockers.push('No identified units');
 if(units.some(u=>u.status==='OUT_OF_SERVICE'))blockers.push('Out of service: '+units.filter(u=>u.status==='OUT_OF_SERVICE').map(u=>u.id).join(', '));
 const family=inc?cadIncidentFamily(inc).id:null;
 const busy=units.filter(u=>state.incidents.some(i=>i.status==='ACTIVE'&&i.units.includes(u.id) && !(family && cadIncidentFamily(i).id===family && i.discipline===u.discipline)));
 if(busy.length&&!preempt){
   const conflicts=busy.map(u=>{const current=state.incidents.filter(i=>i.status==='ACTIVE'&&i.units.includes(u.id)&&!(family&&cadIncidentFamily(i).id===family&&i.discipline===u.discipline));return `${u.id} on ${current.map(i=>`${i.id} (${i.type}, ${i.location})`).join(' / ')}`;});
   blockers.push('DISPATCH CONFLICT: '+conflicts.join('; ')+'. Say PREEMPT to transfer, or keep existing assignment.');
 }
 if(preempt&&busy.some(u=>state.incidents.filter(i=>i.status==='ACTIVE'&&i.units.includes(u.id)&&!(family&&cadIncidentFamily(i).id===family&&i.discipline===u.discipline)).length!==1))
   blockers.push('PREEMPT held: unit has ambiguous existing assignments. Review manually.');
 const id='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const record={id,time:stamp(),source,text,units:units.map(u=>u.id),status:'DISPATCHED',incidentId:inc?.id||null};
 ensure();
 if(inc){
  inc.radioTranscripts.push(record);
  event(inc,`RADIO_TX ${units.map(u=>u.id).join(', ')||'UNIDENTIFIED'}: ${text} [transcript:${id}]`);
 }else state.voiceUnlinked.push(record);
 if(!blockers.length){
  if(preempt){
    for(const u of units){
      const from=state.incidents.find(i=>i.status==='ACTIVE'&&i.id!==inc.id&&i.units.includes(u.id));
      if(!from)continue;
      from.units=from.units.filter(id=>id!==u.id);
      event(from,`PREEMPT_OUT ${u.id} to ${inc.id} [transcript:${id}]`);
      event(inc,`PREEMPT_IN ${u.id} from ${from.id} [transcript:${id}]`);
      if(!from.units.length){from.status='PENDING';event(from,`PREEMPT_EMPTY returned to PENDING [transcript:${id}]`);}
    }
  }
  const destinations=[];
  for(const u of units){
   const resolved=cadDispatchTarget(inc,u);
   const target=resolved.incident;
   if(!target.units.includes(u.id))target.units.push(u.id);
   target.status='ACTIVE';
   const prior=u.status;u.status='DISPATCHED';u.location=target.location;
   target.radioTranscripts ||= [];
   if(target.id!==inc.id)target.radioTranscripts.push({...record,incidentId:target.id});
   event(target,`VOICE_UNIT_ASSIGNED ${u.id} ${prior} -> DISPATCHED [transcript:${id}]`);
   target.voiceNotes ||= [];
   target.voiceNotes.push({id,time:record.time,source:'DISPATCH',summary:`${u.id} dispatched to ${target.type} at ${target.location}${resolved.linked?' (linked from '+inc.id+')':''}.`,method:'rule-based'});
   destinations.push(target);
  }
  for(const target of [...new Set(destinations)]){
   event(target,`RADIO_SUMMARY transcript:${id}`);
   requestAISummary(target.id,id,text,'DISPATCH',target.type,target.location);
  }
  if(destinations.length)inc=destinations[destinations.length-1];
 }else if(inc){
  event(inc,`VOICE_REVIEW Dispatch held: ${blockers.join(' | ')} [transcript:${id}]`);
  // Keep all radio traffic; only the validated assignment is withheld.
  requestAISummary(inc.id,id,text,'DISPATCH',inc.type,inc.location);
 }
 const result=blockers.length?'REVIEW: '+blockers.join('; '):(preempt?'PREEMPTED ':'DISPATCHED ')+units.map(u=>u.id).join(', ')+' to '+inc.id+' ('+found.reason+')';
 activity('TX | '+result);el('voiceHeard').textContent=text;el('voiceInterpretation').textContent=`HEARD: ${text} | UNIT: ${units.map(u=>u.id).join(', ')||'unresolved'} | EVENT: ${inc?.id||'unresolved'} | REQUEST: ${preempt?'Preempt and dispatch':'Dispatch'} | ${result}`;
 if(inc){state.selected=inc.id;activeTab='narrative';}
 save();renderActivity();renderDetail();indicator(blockers.length?'REVIEW':'PROCESSED');
}
// Spoken closure, disposition and case-number handling; deterministic CAD state changes.
function requestedDispo(text){
 // Fire/EMS dispositions must not be restricted to police-only values.
 // Accept explicit "dispo(sition) ..." plus concise "clear, false alarm".
 const t=normalizeRadioStatus(text);
 const match=t.match(/\b(?:dispo|disposition)\b\s*(?:(?:is|of|as|for)\s+)?(.+)$/)
  || t.match(/\bclear(?:ed)?\s+(?:(?:with|as)\s+)?(report taken|arrest made|advice given|false alarm|no fire found|unable to locate|patient refusal|transported|no patient found|cancelled enroute|canceled enroute|unfounded|service provided)\b/)
;
 if(!match)return '';
 let value=match[1].replace(/^(?:is|of|as|for|with)\s+/,'').trim();
 // A bare "clear E1" is NOT a disposition. Neither is a new command.
 if(/^(?:unit|engine|medic|truck|battalion|rescue)\s+\w+$/.test(value)||/^(?:the\s+)?(?:call|event|incident|unit)$/.test(value))return '';
 value=value.replace(/\s+(?:thank you|thanks|copy|over)$/,'').trim();
 return value.length>=3 ? value.slice(0,120).replace(/\b\w/g,c=>c.toUpperCase()) : '';
}
function caseRequest(text){const t=normalizeRadioStatus(text);return /\b(?:request|requesting|requests|need|needs|give|assign|start|issue|get|can i get|can we get)\b.{0,45}\b(?:case|report)\s*(?:number|no|#)\b/.test(t)||/\b(?:case|report)\s*(?:number|no)\s*(?:please|requested|request)\b/.test(t);}
function processAdministrativeRadio(text,source){
 const t=normalizeRadioStatus(text);
 const doClear=/\b(?:clear|cleared)\b/.test(t) && !/\b(?:not|never|cancel|disregard|don't|do not)\b/.test(t);
 const doCase=caseRequest(text);
 if(!doClear&&!doCase)return false;
 ensure();
 const found=contextUnits(text,unitMatches(text));const units=found.units;
 const assigned=state.incidents.filter(i=>i.status==='ACTIVE'&&units.some(u=>i.units.includes(u.id)));
 // A case request may mention only one unit. An ambiguous incident is always reviewed.
 let inc=assigned.length===1?assigned[0]:null;
 if(!inc && units.length===0){const selected=state.incidents.find(i=>i.id===state.selected&&i.status==='ACTIVE');if(selected && doCase)inc=selected;}
 const id='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const blockers=[];const actions=[];
 if(!inc)blockers.push('Cannot uniquely identify the assigned event');
 if(doClear&&!units.length)blockers.push('Cannot identify unit to clear');
 const d=requestedDispo(text);
 if(doClear && /\b(?:dispo|disposition)\b/.test(t) && !d)blockers.push('Disposition mentioned but not recognized. Say CLEAR WITH DISPOSITION followed by the disposition, or enter it manually.');
 if(inc){
  inc.radioTranscripts.push({id,time:stamp(),source,text,units:units.map(u=>u.id),status:doClear?'CLEAR':null,incidentId:inc.id});
  event(inc,`RADIO_${source==='FIELD'?'RX':'TX'} ${units.map(u=>u.id).join(', ')||'UNKNOWN'}: ${text} [transcript:${id}]`);
  if(!blockers.length){
   if(doCase){const existed=Boolean(inc.caseNumber);const num=assignCaseNumber(inc);actions.push(`${existed?'Existing':'Assigned'} case ${num}`);}
   if(doClear){for(const u of units){const result=clearCadUnit(inc,u,d,'VOICE');if(result.ok)actions.push(result.message);else blockers.push(result.message);}}
  }
  requestAISummary(inc.id,id,text,source,inc.type,inc.location);
  state.selected=inc.id;
 } else {state.voiceUnlinked.push({id,time:stamp(),source,text,units:units.map(u=>u.id),incidentId:null});}
 const result=blockers.length?'REVIEW: '+blockers.join('; '):actions.join(' | ');
 el('voiceHeard').textContent=text;el('voiceInterpretation').textContent=`HEARD: ${text} | UNIT: ${units.map(u=>u.id).join(', ')||'unresolved'} | EVENT: ${inc?.id||'unresolved'} | REQUEST: ${doClear?'Clear'+(d?' with disposition '+d:''):'Case number'} | ${blockers.length?'REVIEW: '+blockers.join('; '):'APPLIED: '+actions.join(' | ')}`;
 activity(`${source} | ${result}`);save();renderActivity();renderDetail();indicator(blockers.length?'REVIEW':'PROCESSED');return true;
}
// A single push-to-talk recording can carry independent commands for several
// units on different calls. Dispatch each unambiguous clause against that unit's
// assigned incident rather than demanding one incident for the entire recording.
function splitRadioCommands(text){
 const raw=String(text||'').trim();
 if(!raw)return [];
 // Preserve complete sentences where possible; a comma often follows a callsign
 // and should not be mistaken for the end of a command.
 let chunks=raw.split(/[.;!?]\s+/).map(t=>t.trim()).filter(Boolean);
 // Transcribers sometimes strip punctuation from successive unit reports.
 const identifier=/\b(?:engine|medic|truck|battalion|rescue)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:\d+|one|two|three|four|five|six)\s+(?:adam|alpha|out\s+of)\s+(?:\d+|[a-z]+(?:\s+[a-z]+)?)\b|\b(?:[a-z]\d{1,3}|\d+[a-z]\d+)\b/gi;
 const result=[];
 for(const chunk of chunks){
  const matches=[...chunk.matchAll(identifier)];
  if(matches.length<2){result.push(chunk);continue;}
  let last=0;
  for(let k=1;k<matches.length;k++){
   const at=matches[k].index;
   const previous=chunk.slice(last,at).trim();
   // Split only when the preceding span has a completed operational action.
   if(/\b(?:clear|cleared|on\s+scene|at\s+scene|en\s?route|in\s+route|code\s+(?:4|four)|available|hospital|transporting)\b/i.test(previous)){
    if(previous)result.push(previous.replace(/[,;]\s*$/,''));
    last=at;
   }
  }
  const tail=chunk.slice(last).trim();if(tail)result.push(tail);
 }
 // Never turn a complex transmission into unrelated operations unless every
 // clause explicitly identifies precisely one existing CAD unit.
 if(result.length>1 && result.every(c=>unitMatches(c).length===1))return result;
 return [raw];
}
const previousVoiceProcess=process;
// Treat a confirmed scene report plus a later dispatch order as two sequential
// CAD operations. Otherwise dispatchIntent can consume the entire transmission
// before arrival and incident reclassification are applied.
function splitArrivalAndDispatch(text){
 const full=String(text||'').trim();
 if(!/\b(?:on\s*scene|onscene|at\s+(?:the\s+)?scene)\b/i.test(full))return null;
 if(!/\b(?:working\s+(?:structure\s+)?fire|confirmed\s+.{0,45}\b(?:fire|burglary|robbery|arrest)|upgrade|reclassify)\b/i.test(full))return null;
 let splitAt=-1;
 // Dispatchers commonly say BREAK and THEN name the responding resources.
 // Only split where the second clause has a dispatch/response instruction.
 const breakMatch=/\b(?:break|break\s+break)\s*[.,;:]?\s*/ig;
 for(const m of full.matchAll(breakMatch)){
  const tail=full.slice(m.index+m[0].length);
  if(unitMatches(tail).length && /\b(?:respond|dispatch|start|send|assign)\b/i.test(tail)){
   splitAt=m.index;break;
  }
 }
 let report,dispatch;
 if(splitAt>=0){
  report=full.slice(0,splitAt).trim().replace(/[.,;:]\s*$/,'');
  dispatch=full.slice(splitAt).replace(/^\s*break\s*[.,;:]?\s*/i,'').trim();
 }else{
  // Also support "... Engine 2 and Truck 1 respond ..." when BREAK was omitted.
  const listThenRespond=/\b(?:engine|truck|medic|battalion|rescue)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine)\b[^.!?]{0,105}?\brespond(?:\s+to)?\b/ig;
  for(const m of full.matchAll(listThenRespond)){
   if(m.index>0 && unitMatches(full.slice(0,m.index)).length){splitAt=m.index;break;}
  }
  if(splitAt<0){
   const marker=/\b(?:dispatch|start|send|assign)\s+(?:(?:additional|the|a|an)\s+)*(?=(?:engine|truck|medic|battalion|rescue|[emtbr]\s*\d+)\b)/ig;
   const match=marker.exec(full);if(!match)return null;
   splitAt=match.index;
  }
  report=full.slice(0,splitAt).replace(/(?:\s|[.,;:])*\b(?:break|and|then|copy)\b\s*$/i,'').trim().replace(/[.,;:]\s*$/,'');
  dispatch=full.slice(splitAt).trim();
 }
 if(!report||!dispatch||!unitMatches(report).length||!unitMatches(dispatch).length)return null;
 return {report,dispatch};
}

process=function(text,source=el('voiceSource').value){
 // Preserve the spoken common name until the self-initiated parser resolves it.
 if(window.cadBeforeVoiceProcess?.(text,source)===true)return;
 const compound=splitArrivalAndDispatch(text);
 if(compound){
  previousVoiceProcess(compound.report,source);
  const arrivalFeedback=el('voiceInterpretation').textContent;
  // Dispatch processing receives only the named additional resources, never
  // the arriving/reporting unit in the first part of the radio transmission.
  processDispatch(compound.dispatch,'DISPATCH');
  const assignmentFeedback=el('voiceInterpretation').textContent;
  el('voiceHeard').textContent=text;
  el('voiceInterpretation').textContent='COMBINED RADIO | ARRIVAL / RECLASSIFICATION: '+arrivalFeedback+' | RESOURCE DISPATCH: '+assignmentFeedback;
  activity('COMBINED RADIO | Arrival and dispatch independently evaluated');
  renderActivity();return;
 }
 const clauses=splitRadioCommands(text);
 if(clauses.length>1){
  // Keep the complete radio message as well as its individual operational entries.
  activity(`${source} | COMPOUND RADIO: ${text}`);
  const results=[];
  for(const clause of clauses){
   if(processAdministrativeRadio(clause,source)){}
   else if(dispatchIntent(clause,source))processDispatch(clause,source);
   else previousVoiceProcess(clause,source);
   results.push(el('voiceInterpretation').textContent);
  }
  el('voiceHeard').textContent=text;
  el('voiceInterpretation').textContent='MULTI-UNIT | '+results.map((r,i)=>`${i+1}. ${r}`).join(' | ');
  activity(`${source} | Processed ${clauses.length} distinct radio commands`);
  save();renderActivity();renderDetail();
  return;
 }
 if(/\b(?:upgrade|reclassify|reclass|change (?:the )?(?:call|event|incident) type|update (?:the )?(?:call|event|incident) type)\b/i.test(text)){
  const parsed=window.cadIncidentIntelligence?.classification(text);
  const mentioned=unitMatches(text);
  const target=window.cadIncidentIntelligence?.resolveIncident(text,mentioned.map(u=>u.id));
  const result=target?window.cadIncidentIntelligence.apply(target,parsed,text,source+' EXPLICIT'):{review:'Could not uniquely resolve an active incident; no change made'};
  el('voiceHeard').textContent=text;
  el('voiceInterpretation').textContent=`HEARD: ${text} | EVENT: ${target?.id||'unresolved'} | REQUEST: Reclassify | ${result?.applied?'APPLIED: '+result.applied:result?.note?'NO CHANGE: '+result.note:'REVIEW: '+(result?.review||'No recognized classification')}`;
  activity(`${source} | ${result?.applied||result?.review||'No change'}`);if(result?.applied){state.selected=target.id;save();renderDetail();}renderActivity();indicator(result?.applied?'PROCESSED':'REVIEW');return;
 }
 if(processAdministrativeRadio(String(text||'').trim(),source))return;
 if(dispatchIntent(String(text||''),source))return processDispatch(String(text).trim(),source);
 return previousVoiceProcess(text,source);
};

renderActivity();
})();
