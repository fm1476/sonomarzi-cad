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
 const recognizedIds=window.CadVoiceText.numericCallsigns(text);
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
   if(recognizedIds.includes(u.id.toUpperCase()))return true;
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
  .replace(/\bcode\s+(?:four|for)\b/g,'code 4')
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
const operational=window.CadRadioPhraseIntents?.classify(text);
if(operational)return {status:null,reason:operational.label+' recognized: review unit and '+operational.requires.join(', ')+' before creating or updating a record'};
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
function process(text,source=el('voiceSource').value){text=String(text||'').trim();if(!text){indicator('READY');return;}ensure();const match=contextUnits(text,unitMatches(text)),units=match.units,parsed=parseStatus(window.CadRadioStatusRepair.repair(text,match.resolution==='explicit'&&units.length===1));const selectedActive=state.incidents.find(i=>i.id===state.selected&&i.status==='ACTIVE');const inc=association(units,source,parsed.status)||(!units.length?selectedActive:null);const tid='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);const record={id:tid,time:stamp(),timestamp:new Date().toISOString(),source,text,units:units.map(x=>x.id),status:parsed.status,incidentId:inc?.id||null};const actions=[];const blockers=[];const observed=units.map(u=>u.id).join(', ')||'NONE';
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
 const note={id:tid,time:record.time,timestamp:record.timestamp,summary:s,source:units.length===1?units[0].id:source,method:'rule-based'};
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
  else{note={id:transcriptId,time:record.time,timestamp:record.timestamp,summary:data.summary,source:speaker,method:'ai',uncertainties:data.uncertainties||[]};incident.voiceNotes.push(note);}
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
 const legacy=(i.narrative||[]).filter(x=>!x.includes('[Radio summary]'));
 const manual=i.manualNarrativeEntries||[];
 const unmatched=[...manual];
 const legacyItems=legacy.filter(text=>{const ix=unmatched.findIndex(n=>n.text===text);if(ix<0)return true;unmatched.splice(ix,1);return false});
 const clockTime=clock=>{const m=String(clock||'').match(/(\d{1,2}):(\d{2}):(\d{2})/);if(!m)return null;const d=new Date();d.setHours(+m[1],+m[2],+m[3],0);return d.getTime()};
 const stampTime=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:null};
 const items=[...legacyItems.map((text,index)=>({kind:'legacy',text,index,time:null})),...notes.map((note,index)=>({kind:'summary',note,index,time:stampTime(note.timestamp)??clockTime(note.time)})),...manual.map((note,index)=>({kind:'manual',note,index,time:stampTime(note.timestamp)}))];
 items.sort((a,b)=>{if(a.time!==null&&b.time!==null)return newestFirst?b.time-a.time:a.time-b.time;if(a.time===null&&b.time!==null)return newestFirst?1:-1;if(b.time===null&&a.time!==null)return newestFirst?-1:1;return newestFirst?b.index-a.index:a.index-b.index});
 const formatDate=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Timestamp unavailable'};
 const narrativeHtml=items.map(item=>{
  if(item.kind==='legacy')return '<div class="voice-entry cad-narrative-manual"><div class="meta">Manual narrative | Legacy entry, timestamp unavailable</div>'+safe(item.text)+'</div>';
  if(item.kind==='manual')return '<div class="voice-entry cad-narrative-manual"><div class="meta">'+safe(formatDate(item.note.timestamp))+' | Dispatcher note · '+safe(item.note.author||'Unidentified')+'</div>'+safe(item.note.text)+'</div>';
  const n=item.note;return '<div class="voice-entry"><div class="meta">'+safe(n.timestamp?formatDate(n.timestamp):String(n.time||'Time unavailable')+' | Date not recorded')+' | '+safe(n.source)+' | '+(n.method==='ai'?'AI summary':'Local summary')+'</div>'+safe(n.summary)+(n.uncertainties?.length?' <span class="meta">[Check: '+safe(n.uncertainties.join('; '))+']</span>':'')+' <button data-transcript-ref="'+safe(n.id)+'">Source transcript ↗</button></div>';
 }).join('')||'<div class="narr muted">No narrative yet.</div>';
 const orderedTrans=[...trans].sort((a,b)=>newestFirst?String(b.timestamp||b.time||'').localeCompare(String(a.timestamp||a.time||'')):String(a.timestamp||a.time||'').localeCompare(String(b.timestamp||b.time||'')));
  const transcriptHtml=orderedTrans.map(r=>`<div class="voice-entry ${highlightId===r.id?'highlight':''}" data-transcript-id="${safe(r.id)}"><div class="meta">${safe(r.time)} | ${r.source==='FIELD'?'Incoming':'Outgoing'} | ${safe((r.units||[]).join(', ')||'Unidentified')}</div>${safe(r.text)}</div>`).join('')||'<div class="narr muted">No radio transmissions linked to this event.</div>';
 return `<div class="voice-log-count">Radio records linked to this event: <strong>${trans.length}</strong> | Summaries: <strong>${notes.length}</strong></div><div class="voice-tabs"><button data-voice-tab="narrative" class="${activeTab==='narrative'?'active':''}">Event Narrative (${items.length} entries)</button><button data-voice-tab="transcript" class="${activeTab==='transcript'?'active':''}">Radio Transcript (${trans.length})</button><label class="voice-order-label" title="Choose whether the most recent entries appear first or last">Order: <select id="voiceEntryOrder"><option value="newest" ${newestFirst?'selected':''}>Newest on top</option><option value="oldest" ${!newestFirst?'selected':''}>Newest on bottom</option></select></label></div><div class="voice-detail-content" tabindex="0" role="region" aria-label="${activeTab==='narrative'?'Event narrative':'Radio transcript'}">${activeTab==='narrative'?narrativeHtml:transcriptHtml}</div>`;
};
function ensureDispatcherIdentity(){
 let id=(localStorage.getItem('smcad-dispatcher-identity-v1')||'').trim();
 if(id)return id;
 const entered=prompt('Dispatcher ID or initials for narrative attribution (saved on this browser):','');
 if(entered?.trim()){id=entered.trim().slice(0,24);localStorage.setItem('smcad-dispatcher-identity-v1',id);return id}
 return null;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-act="note"]'))ensureDispatcherIdentity()},true);
window.cadVoiceSetOrder=value=>{newestFirst=value!=='oldest';localStorage.setItem('smcad-voice-order-v17.3',newestFirst?'newest':'oldest')};
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
 const record={id,time:stamp(),timestamp:new Date().toISOString(),source,text,units:units.map(u=>u.id),status:'DISPATCHED',incidentId:inc?.id||null};
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
   target.voiceNotes.push({id,time:record.time,timestamp:record.timestamp,source:'DISPATCH',summary:`${u.id} dispatched to ${target.type} at ${target.location}${resolved.linked?' (linked from '+inc.id+')':''}.`,method:'rule-based'});
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

// Shared voice dispatch must write through authenticated Supabase RPC, never
// through a temporary projection of the shared board.
let sharedVoiceDispatchPending=false;
async function processSharedVoiceDispatch(text){
 const heard=String(text||'').trim();
 const found=matchDispatchIncident(heard);
 const units=window.CadSharedVoiceIntents?.unitList(heard,state.units,window.CadVoiceText)||[];
 const failure=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | REQUEST: Shared dispatch | REVIEW: '+reason+'. No shared dispatch confirmed.';
  indicator('REVIEW');activity('SHARED VOICE REVIEW | '+reason);renderActivity();
 };
 if(sharedVoiceDispatchPending)return failure('Previous shared dispatch is still processing');
 if(!found.incident)return failure('No unique incident: '+found.reason);
 if(units.length!==1)return failure(units.length?'Multiple units identified; review separately':'No uniquely recognized unit');
 if(/\b(?:preempt|override|cancel|disregard|hold off|do not|don't)\b/i.test(heard))return failure('Sensitive or negated dispatch requires manual review');
 const incident=found.incident,unit=units[0];
 if(!incident.sharedUuid||!unit.sharedUuid)return failure('Shared incident or unit record not available');
 if(incident.status==='CLOSED')return failure('Incident closed');
 if(unit.discipline!==incident.discipline)return failure('Cross-discipline linked dispatch needs explicit shared workflow');
 if(!['AVAILABLE','CLEAR'].includes(unit.status))return failure(unit.id+' is '+unit.status+'; cannot dispatch');
 if(state.incidents.some(i=>i.status==='ACTIVE'&&(i.units||[]).includes(unit.id)))return failure(unit.id+' has an existing assignment');
 if(typeof window.cadSharedCommand!=='function')return failure('Authenticated shared command gateway unavailable');
 sharedVoiceDispatchPending=true;
 el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+incident.id+' | REQUEST: Shared dispatch | PENDING: verifying database assignment…';
 indicator('PROCESSING');
 try{
  await window.cadSharedCommand('assign',{incidentId:incident.sharedUuid,unitId:unit.sharedUuid});
  const projected=window.cadSafetyState?.();
  const confirmed=projected?.incidents?.find(i=>i.sharedUuid===incident.sharedUuid);
  const confirmedUnit=projected?.units?.find(u=>u.sharedUuid===unit.sharedUuid);
  if(!confirmed||(confirmed.status!=='ACTIVE')||!(confirmed.units||[]).includes(unit.id)||confirmedUnit?.status!=='DISPATCHED')
   return failure('Shared command returned, but refreshed incident assignment and DISPATCHED status were not both confirmed');
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+confirmed.id+' | REQUEST: Dispatch | CONFIRMED IN SHARED CAD: '+unit.id+' DISPATCHED and event ACTIVE';
  activity('SHARED VOICE DISPATCH CONFIRMED | '+unit.id+' → '+confirmed.id);renderActivity();indicator('PROCESSED');return true;
 }catch(error){failure(error?.message||'Shared dispatch failed');return false}
 finally{sharedVoiceDispatchPending=false;}
}
// Explicitly confirmed reports can change the shared call type. When the same
// transmission reports arrival, first persist the status, then the classification.
// PREEMPT is one atomic shared transaction. Do not clear and then separately
// assign: a failed second command would strand a unit between incidents.
async function processSharedVoicePreempt(text){
 const heard=String(text||'').trim();
 const fail=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | REQUEST: PREEMPT | REVIEW: '+reason+'. No transfer confirmed.';
  indicator('REVIEW');activity('SHARED PREEMPT REVIEW | '+reason);renderActivity();
 };
 if(sharedVoiceDispatchPending)return fail('Another shared CAD transaction is processing');
 if(/\b(?:cancel|disregard|negative|not|do not|don't|hold off)\b/i.test(heard))return fail('Negated PREEMPT requires operator review');
 const targets=unitMatches(heard);
 if(targets.length!==1)return fail('Exactly one existing roster unit must be identified');
 const unit=targets[0];
 const source=state.incidents.filter(i=>i.status==='ACTIVE'&&(i.units||[]).includes(unit.id));
 if(source.length!==1||!source[0].sharedUuid||!unit.sharedUuid)return fail('Unit must be assigned to exactly one active shared incident');
 const found=matchDispatchIncident(heard);
 const destination=found.incident;
 if(!destination?.sharedUuid)return fail('Destination event is not uniquely identified: '+found.reason);
 if(destination.sharedUuid===source[0].sharedUuid)return fail('Destination must be different from current incident');
 if(destination.discipline!==unit.discipline)return fail('Cross-discipline transfer needs an explicit linked event');
 if(typeof window.cadSharedCommand!=='function')return fail('Authenticated shared command unavailable');
 sharedVoiceDispatchPending=true;
 el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | PREEMPT '+source[0].id+' → '+destination.id+' | PENDING shared confirmation…';
 indicator('PROCESSING');
 try{
  await window.cadSharedCommand('preempt',{incidentId:destination.sharedUuid,fromIncidentId:source[0].sharedUuid,unitId:unit.sharedUuid});
  const latest=window.cadSafetyState?.();
  const previous=latest?.incidents?.find(i=>i.sharedUuid===source[0].sharedUuid);
  const next=latest?.incidents?.find(i=>i.sharedUuid===destination.sharedUuid);
  const rosterUnit=latest?.units?.find(u=>u.sharedUuid===unit.sharedUuid);
  if(!previous||!next||(previous.units||[]).includes(unit.id)||!(next.units||[]).includes(unit.id)||next.status!=='ACTIVE'||rosterUnit?.status!=='DISPATCHED')
   return fail('Transaction returned but source removal, destination assignment and DISPATCHED status were not all verified');
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | CONFIRMED SHARED PREEMPT: '+previous.id+' → '+next.id+' | STATUS: DISPATCHED';
  activity('SHARED PREEMPT CONFIRMED | '+unit.id+' '+previous.id+' → '+next.id);renderActivity();indicator('PROCESSED');
 }catch(error){fail(error?.message||'Shared PREEMPT transaction failed')}
 finally{sharedVoiceDispatchPending=false;}
}
async function processSharedVoiceBatchDispatch(text){
 const heard=String(text||'').trim();
 const fail=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | REQUEST: Multi-unit dispatch | REVIEW: '+reason+'. No complete dispatch confirmed.';
  indicator('REVIEW');activity('SHARED MULTI-UNIT REVIEW | '+reason);renderActivity();return false;
 };
 if(sharedVoiceDispatchPending)return fail('Another shared CAD transaction is in progress');
 const units=window.CadSharedVoiceIntents?.unitList(heard,state.units,window.CadVoiceText)||[];
 if(units.length<2)return fail('Two or more uniquely identified roster units required');
 if(/\b(?:cancel|disregard|negative|do not|don't|hold off|preempt)\b/i.test(heard))return fail('Negated or sensitive order');
 const found=matchDispatchIncident(heard),incident=found.incident;
 if(!incident?.sharedUuid)return fail('Destination incident is not unique: '+found.reason);
 if(incident.status==='CLOSED')return fail('Destination incident closed');
 if(units.some(u=>!u.sharedUuid||u.status!=='AVAILABLE'))return fail('All requested units must be known and available');
 if(units.some(u=>state.incidents.some(i=>i.status==='ACTIVE'&&(i.units||[]).includes(u.id))))return fail('One or more units already assigned');
 sharedVoiceDispatchPending=true;
 el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNITS: '+units.map(u=>u.id).join(', ')+' | EVENT: '+incident.id+' | PENDING: shared batch dispatch…';
 indicator('PROCESSING');
 try{
  const response=await window.cadSharedCommand('batch-assign',{incidentId:incident.sharedUuid,unitIds:units.map(u=>u.sharedUuid)});
  const latest=window.cadSafetyState?.();
  const current=latest?.incidents?.find(i=>i.sharedUuid===incident.sharedUuid);
  const successes=units.filter(u=>(current?.units||[]).includes(u.id)&&latest?.units?.find(x=>x.sharedUuid===u.sharedUuid)?.status==='DISPATCHED');
  const missing=units.filter(u=>!successes.includes(u));
  if(missing.length||response?.incomplete||!current||current.status!=='ACTIVE'){
   return fail('Partial or unverified batch: confirmed '+(successes.map(u=>u.id).join(', ')||'none')+'; not confirmed '+(missing.map(u=>u.id).join(', ')||'none')+'. Inspect both rosters before retrying.');
  }
  el('voiceInterpretation').textContent='HEARD: '+heard+' | EVENT: '+current.id+' | CONFIRMED SHARED DISPATCH: '+successes.map(u=>u.id).join(', ')+' DISPATCHED';
  activity('SHARED BATCH DISPATCH CONFIRMED | '+current.id+' '+successes.map(u=>u.id).join(', '));renderActivity();indicator('PROCESSED');return true;
 }catch(error){return fail(error?.message||'Shared batch dispatch failed')}
 finally{sharedVoiceDispatchPending=false;}
}
async function processSharedVoiceCompound(text){
 const heard=String(text||'').trim();
 const segments=heard.split(/\s*\b(?:break|brake)\b\s*[,.!?;]*\s*/i).map(s=>s.trim()).filter(Boolean);
 if(segments.length!==2)return false;
 const first=segments[0],second=segments[1];
 const intelligence=window.cadIncidentIntelligence?.classification(first);
 const firstUnits=window.CadSharedVoiceIntents?.unitList(first,state.units,window.CadVoiceText)||[];
 if(firstUnits.length!==1||intelligence?.type!=='Structure Fire'||!(/\b(?:confirmed|working)\b/i.test(first))){
  el('voiceInterpretation').textContent='COMPOUND RADIO REVIEW: First clause requires one identified unit and confirmed classification. No second command attempted.';
  indicator('REVIEW');return true;
 }
 const owned=state.incidents.filter(i=>i.status==='ACTIVE'&&(i.units||[]).includes(firstUnits[0].id));
 if(owned.length!==1||!owned[0].sharedUuid){
  el('voiceInterpretation').textContent='COMPOUND RADIO REVIEW: Reporting unit has no unique active incident. No changes made.';
  indicator('REVIEW');return true;
 }
 const secondUnits=window.CadSharedVoiceIntents?.unitList(second,state.units,window.CadVoiceText)||[];
 const explicitOrder=/\b(?:respond|dispatch|assign|send|start)\b/i.test(second);
 const destination=explicitOrder?matchDispatchIncident(second).incident:null;
 const sameCall=destination?.sharedUuid===owned[0].sharedUuid;
 // Never guess a missing dispatch address/order from a truncated ASR transcript.
 // A complete second clause is checked before committing the first, but a
 // trustworthy first clause can still be processed independently.
 const canDispatch=explicitOrder&&secondUnits.length>=1&&sameCall;
 const firstDone=await processSharedVoiceReclassification(first,intelligence);
 if(firstDone!==true)return true;
 el('voiceHeard').textContent=heard;
 if(!canDispatch){
  const reason=!explicitOrder?'No dispatch verb was transcribed':secondUnits.length===0?'No dispatch unit was identified':!destination?'Destination incident was not uniquely identified':'Destination does not match E1\'s incident';
  el('voiceInterpretation').textContent='COMPOUND RADIO: Confirmed working-fire report from '+firstUnits[0].id+' on '+owned[0].id+'; ADDITIONAL DISPATCH HELD: '+reason+'. Repeat the complete order. On-scene status is confirmed only when clearly recognized.';
  indicator('REVIEW');activity('SHARED COMPOUND PARTIAL | '+reason);renderActivity();return true;
 }
 const secondDone=secondUnits.length>1?await processSharedVoiceBatchDispatch(second):await processSharedVoiceDispatch(second);
 el('voiceHeard').textContent=heard;
 if(secondDone!==true){
  el('voiceInterpretation').textContent='COMPOUND RADIO: Working-fire report processed on '+owned[0].id+'; additional dispatch NOT fully confirmed. Inspect shared board.';
  indicator('REVIEW');
 }else el('voiceInterpretation').textContent='COMPOUND RADIO: Working-fire report processed for '+firstUnits[0].id+'; additional units '+secondUnits.map(u=>u.id).join(', ')+' dispatched to '+owned[0].id;

 return true;
}
async function processSharedVoiceReclassification(text,parsed){
 const heard=String(text||'').trim();
 const candidates=window.CadSharedVoiceIntents?.unitList(heard,state.units,window.CadVoiceText)||[];
 const fail=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | REQUEST: CFS reclassification | REVIEW: '+reason+'. No CFS type change confirmed.';
  indicator('REVIEW');activity('SHARED RECLASS REVIEW | '+reason);renderActivity();
 };
 if(sharedVoiceDispatchPending)return fail('Another shared command is processing');
 if(candidates.length!==1){
  const possible=state.incidents.filter(i=>i.status==='ACTIVE'&&i.discipline==='FIRE'&&/fire alarm|alarm/i.test(i.type||''))
    .flatMap(i=>(i.units||[]).map(id=>({id,event:i.id})))
    .filter(({id})=>/^E\d+$/i.test(id));
  const hint=possible.length===1?' Possible assigned engine: '+possible[0].id+' on '+possible[0].event+'; operator confirmation required.':'';
  return fail('No uniquely recognized reporting unit.'+hint+' Repeat the callsign; no changes were made');
 }
 const unit=candidates[0];
 const owned=state.incidents.filter(i=>i.status==='ACTIVE'&&(i.units||[]).includes(unit.id));
 if(owned.length!==1||!owned[0].sharedUuid||!unit.sharedUuid)return fail('Reporting unit needs one uniquely assigned active shared incident');
 const incident=owned[0];
 if(parsed.review)return fail(parsed.review);
 if(!parsed.type||parsed.discipline!==incident.discipline)return fail('Classification not supported for this incident discipline');
 if(parsed.type===incident.type)return fail('Incident is already classified as '+parsed.type);
 if(!['Structure Fire','Vegetation Fire','Vehicle Fire','Fire Alarm','Cardiac Arrest','Medical Aid','Overdose','Burglary','Robbery','Domestic','Traffic Collision','Welfare Check'].includes(parsed.type))
  return fail('This classification requires agency configuration and server validation');
 if(/\b(?:possible|possibly|potential|suspected|maybe|might|may be|unconfirmed|negative|not|no evidence|cancel|disregard)\b/i.test(heard))
  return fail('Unconfirmed or negated report');
 sharedVoiceDispatchPending=true;
 el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+incident.id+' | PENDING: verifying incident reclassification…';
 indicator('PROCESSING');
 try{
  const status=window.CadSharedVoiceIntents?.classify(heard);
  if(status?.kind==='STATUS'&&status.status==='ONSCENE'&&unit.status!=='ONSCENE'){
   await window.cadSharedCommand('status',{incidentId:incident.sharedUuid,unitId:unit.sharedUuid,status:'ONSCENE'});
  }
  await window.cadSharedCommand('reclassify',{incidentId:incident.sharedUuid,unitId:unit.sharedUuid,type:parsed.type,report:heard});
  const current=window.cadSafetyState?.();
  const latest=current?.incidents?.find(i=>i.sharedUuid===incident.sharedUuid);
  const latestUnit=current?.units?.find(u=>u.sharedUuid===unit.sharedUuid);
  if(!latest||latest.type!==parsed.type||!(latest.units||[]).includes(unit.id))
    return fail('The database returned but the shared CFS type or assignment was not confirmed');
  if(status?.kind==='STATUS'&&status.status==='ONSCENE'&&latestUnit?.status!=='ONSCENE')
    return fail('CFS changed, but the on-scene status was not verified; inspect shared CAD');
  if(/\brequesting (?:the )?balance of (?:the )?assignment\b/i.test(heard)){
   await window.cadSharedCommand('note',{incidentId:incident.sharedUuid,text:'FIELD REQUEST — balance of assignment requested by '+unit.id+'. Dispatch additional resources according to the agency response plan; request not automatically filled.'});
  }
  const message=incident.type+' → '+parsed.type;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+latest.id+' | CONFIRMED SHARED CFS UPDATE: '+message;
  activity('SHARED CFS RECLASSIFIED | '+latest.id+' '+message);renderActivity();indicator('PROCESSED');return true;
 }catch(error){fail(error?.message||'Shared reclassification failed');return false}
 finally{sharedVoiceDispatchPending=false;}
}
async function processSharedVoiceCaseNumber(text){
 const heard=String(text||'').trim();
 const fail=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | REQUEST: Case number | REVIEW: '+reason+'. No case number assignment confirmed.';
  activity('SHARED CASE NUMBER REVIEW | '+reason);renderActivity();indicator('REVIEW');
 };
 if(sharedVoiceDispatchPending)return fail('A shared command is already processing');
 if(/\b(?:cancel|disregard|negative|do not|don't|not requesting)\b/i.test(heard))return fail('Negated request');
 const unit=window.CadSharedVoiceIntents?.callsigns(heard,state.units,window.CadVoiceText);
 if(!unit?.sharedUuid)return fail('Exactly one reporting unit must be identified');
 const assigned=state.incidents.filter(i=>i.status==='ACTIVE'&&(i.units||[]).includes(unit.id));
 if(assigned.length!==1||!assigned[0].sharedUuid)return fail('Reporting unit needs exactly one active incident assignment');
 const incident=assigned[0];
 if(typeof window.cadSharedCommand!=='function')return fail('Authenticated case number command unavailable');
 sharedVoiceDispatchPending=true;el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+incident.id+' | PENDING: case number allocation…';
 indicator('PROCESSING');
 try{
  const assignedResult=await window.cadSharedCommand('allocate-case',{incidentId:incident.sharedUuid});
  const current=window.cadSafetyState?.().incidents?.find(i=>i.sharedUuid===incident.sharedUuid);
  if(!current?.caseNumber||assignedResult?.case_number!==current.caseNumber)return fail('Allocation returned but case number was not verified in shared CAD');
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+current.id+' | CONFIRMED CASE NUMBER: '+current.caseNumber;
  activity('SHARED CASE NUMBER | '+current.id+' '+current.caseNumber);renderActivity();indicator('PROCESSED');
 }catch(error){fail(error?.message||'Case number allocation failed')}
 finally{sharedVoiceDispatchPending=false;}
}
async function processSharedVoiceStatus(text){
 const heard=String(text||'').trim();
 const intents=window.CadSharedVoiceIntents;
 const intent=intents?.classify(heard)||{kind:'REVIEW',reason:'Radio intent library unavailable'};
 const unit=intents?.callsigns(heard,state.units,window.CadVoiceText);
 const fail=reason=>{
  el('voiceHeard').textContent=heard;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+(unit?.id||'unresolved')+' | SHARED CAD REVIEW: '+reason+'. No status change confirmed.';
  activity('SHARED RADIO REVIEW | '+reason);renderActivity();indicator('REVIEW');
 };
 if(intent.kind==='REVIEW')return fail(intent.reason);
 if(sharedVoiceDispatchPending)return fail('Another shared radio transaction is processing');
 if(!unit?.sharedUuid)return fail('No unique roster unit identified');
 const assigned=state.incidents.filter(i=>i.status==='ACTIVE'&&(i.units||[]).includes(unit.id));
 if(assigned.length!==1||!assigned[0].sharedUuid)return fail('Exactly one active unit assignment is required');
 const incident=assigned[0];
 if(typeof window.cadSharedCommand!=='function')return fail('Authenticated shared command unavailable');
 if(intent.kind==='STATUS'&&unit.status===intent.status)return fail('Unit already reports '+intent.status);
 if(intent.kind==='CLEAR'&&unit.status==='AVAILABLE')return fail('Unit already available');
 sharedVoiceDispatchPending=true;
 el('voiceHeard').textContent=heard;
 el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+incident.id+' | PENDING: verifying shared radio transaction…';
 indicator('PROCESSING');
 try{
  if(intent.kind==='STATUS')await window.cadSharedCommand('status',{incidentId:incident.sharedUuid,unitId:unit.sharedUuid,status:intent.status});
  else await window.cadSharedCommand('clear',{incidentId:incident.sharedUuid,unitId:unit.sharedUuid,disposition:'CLEARED'});
  const latest=window.cadSafetyState?.();
  const freshUnit=latest?.units?.find(u=>u.sharedUuid===unit.sharedUuid);
  const freshEvent=latest?.incidents?.find(i=>i.sharedUuid===incident.sharedUuid);
  const confirmed=intent.kind==='STATUS'
   ?freshUnit?.status===intent.status&&(freshEvent?.units||[]).includes(unit.id)
   :freshUnit?.status==='AVAILABLE'&&!(freshEvent?.units||[]).includes(unit.id);
  if(!confirmed)return fail('Database operation returned, but refreshed status and assignment do not match');
  const label=intent.kind==='CLEAR'?'CLEARED / AVAILABLE':intent.status;
  el('voiceInterpretation').textContent='HEARD: '+heard+' | UNIT: '+unit.id+' | EVENT: '+incident.id+' | CONFIRMED IN SHARED CAD: '+label;
  activity('SHARED RADIO CONFIRMED | '+unit.id+' '+label);renderActivity();indicator('PROCESSED');
 }catch(err){fail(err?.message||'Shared operation failed')}
 finally{sharedVoiceDispatchPending=false;}
}
process=function(text,source=el('voiceSource').value){
 // Map requests are view-only: let the dedicated map parser handle them
 // before any shared/local radio dispatch/status handlers.
 if(window.cadMapVoiceCommand?.(text)){
  el('voiceHeard').textContent=String(text||'');
  el('voiceInterpretation').textContent='MAP REQUEST: '+text+' | Read-only map command forwarded. Check Ask the Map for the result.';
  indicator('PROCESSED');
  return;
 }
 // Shared workspace is database-authoritative: never invoke legacy voice
 // handlers that mutate projected local state or show false success.
 if(window.cadSharedIsActive?.()){
  if(/\b(?:break|brake)\b/i.test(text)){void processSharedVoiceCompound(text);return;}
  const parsed=window.CadSharedVoiceIntents?.classify(text);
  const classification=window.cadIncidentIntelligence?.classification(text);
  if(/\b(?:request(?:ing)?|need|give|assign|issue|allocate)\s+(?:me\s+)?(?:a\s+|the\s+)?case\s*(?:number|#)|\bcase\s*number\s*(?:request|please)\b/i.test(text))void processSharedVoiceCaseNumber(text);
  else if(/\bpreempt\b/i.test(text))void processSharedVoicePreempt(text);
  else if(classification?.type||classification?.review&&/\b(?:working|structure fire|vegetation fire|vehicle fire|cardiac arrest|overdose|reclassify|upgrade)\b/i.test(text))
   void processSharedVoiceReclassification(text,classification);
  else if(parsed?.kind==='STATUS'||parsed?.kind==='CLEAR')void processSharedVoiceStatus(text);
  else if(source==='DISPATCH'&&dispatchIntent(text,source)&&(window.CadSharedVoiceIntents?.unitList(text,state.units,window.CadVoiceText)||[]).length>1)void processSharedVoiceBatchDispatch(text);
  else if(source==='DISPATCH'&&dispatchIntent(text,source)&&!/\b(?:traffic stop|out with|follow[ -]?up|cancel|disregard|do not|don't|preempt)\b/i.test(text))void processSharedVoiceDispatch(text);
  else{
   el('voiceHeard').textContent=String(text||'');
   el('voiceInterpretation').textContent='SHARED CAD REVIEW: '+(parsed?.reason||'This voice action lacks a verified shared workflow')+'. No shared change made.';
   indicator('REVIEW');
  }
  return;
 }
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
