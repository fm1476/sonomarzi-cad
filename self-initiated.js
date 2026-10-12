/* Configurable self-initiated CAD actions. No AI model directly modifies records. */
(()=>{'use strict';
const defaults={LAW:{'Traffic Stop':{enabled:true,code:'TS',status:'ONSCENE'}}};
function rules(){config.selfInitiated ||= structuredClone(defaults);return config.selfInitiated}
function entries(){const result=[];for(const d of ['LAW','FIRE','EMS'])for(const type of config.types?.[d]||[]){const rule=rules()[d]?.[type]||Object.entries(rules()[d]||{}).find(([name])=>normalize(name)===normalize(type))?.[1];if(rule?.enabled)result.push({discipline:d,type,rule})}return result;}
function display(){const host=document.getElementById('selfInitiatedSettings');if(!host)return;const existing=rules();host.innerHTML='';for(const disc of ['LAW','FIRE','EMS']){const header=document.createElement('h4');header.textContent=disc;host.append(header);for(const type of config.types?.[disc]||[]){const setting=existing[disc]?.[type]||Object.entries(existing[disc]||{}).find(([name])=>normalize(name)===normalize(type))?.[1]||{};const row=document.createElement('div');row.className='self-rule-row';const check=document.createElement('input');check.type='checkbox';check.checked=!!setting.enabled;check.dataset.disc=disc;check.dataset.type=type;const label=document.createElement('label');label.textContent=type;label.prepend(check);const code=document.createElement('input');code.placeholder='Short code e.g. ATC';code.maxLength=10;code.value=setting.code||'';const status=document.createElement('select');for(const [v,t] of [['ENROUTE','Enroute'],['ONSCENE','On Scene'],['DISPATCHED','Dispatched']]){const o=new Option(t,v);status.add(o)}status.value=setting.status||'ONSCENE';row.append(label,code,status);row._data={disc,type,check,code,status};host.append(row)}}}
function collect(){const result={};for(const row of document.querySelectorAll('.self-rule-row')){const {disc,type,check,code,status}=row._data;result[disc]||={};const c=code.value.trim().toUpperCase();if(c&&!/^[A-Z][A-Z0-9]{1,9}$/.test(c))return `Invalid code for ${type}. Use 2–10 letters/numbers.`;result[disc][type]={enabled:check.checked,code:c,status:status.value}}const codes=Object.values(result).flatMap(x=>Object.values(x)).filter(x=>x.enabled&&x.code).map(x=>x.code);if(new Set(codes).size!==codes.length)return 'Self-initiated command codes must be unique.';config.selfInitiated=result;localStorage.setItem('smcad-config-v1',JSON.stringify(config));return ''}
const oldSave=document.getElementById('saveConfig').onclick;document.getElementById('saveConfig').onclick=e=>{const err=collect();if(err){alert(err);return;}oldSave.call(e.currentTarget,e);display()};
const nav=document.querySelector('[data-view="config"]');nav?.addEventListener('click',()=>setTimeout(display,0));display();
function normalize(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function locateUnit(text){
 // Voice.js keeps its unitMatches resolver private to an IIFE. Never rely on
 // a global function being present for self-initiated incidents.
 const digits={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50};
 let spoken=String(text||'').toLowerCase().replace(/([0-9])\s*(adam|alpha|boy|bravo)\s*(?=[0-9])/g,'$1 $2 ')
  .replace(/\b(three|two|one|four|five|six|seven|eight|nine|ten)\s+(adam|alpha|a|boy|bravo|b)\s+(twenty|thirty|forty|fifty)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g,(_,a,b,c,d)=>`${digits[a]} ${b} ${digits[c]+digits[d]}`)
  .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\b/g,w=>String(digits[w]));
 spoken=spoken.replace(/\b(20|30|40|50)\s+([1-9])\b/g,(_,a,b)=>String(+a + +b))
  .replace(/\b(adam|alpha|addam)\b/g,'a').replace(/\b(boy|bravo)\b/g,'b')
  .replace(/\b(engine)\b/g,'e').replace(/\b(truck)\b/g,'t').replace(/\b(medic)\b/g,'m').replace(/\b(battalion|batallion)\b/g,'b')
  .replace(/\b(sheriff)\b/g,'so').replace(/\b(rescue)\b/g,'r');
 const ids=new Set();
 for(const u of state.units){
  const id=u.id.toLowerCase(), parts=id.match(/^(\d+)([a-z]+)(\d+)$/), apparatus=id.match(/^([a-z]+)(\d+)$/);
  if(new RegExp('(?:^|[^a-z0-9])'+id+'(?=$|[^a-z0-9])','i').test(spoken))ids.add(u.id);
  else if(parts&&new RegExp('(?:^|[^a-z0-9])'+parts[1]+'\\s*'+parts[2]+'\\s*'+parts[3]+'(?=$|[^a-z0-9])','i').test(spoken))ids.add(u.id);
  else if(apparatus&&new RegExp('(?:^|[^a-z0-9])'+apparatus[1]+'\\s*'+apparatus[2]+'(?=$|[^a-z0-9])','i').test(spoken))ids.add(u.id);
 }
 return ids.size===1?state.units.find(u=>ids.has(u.id)):null;
}
// Convert a spoken house number at the start of a location without rewriting the radio transcript.
// Handles common dispatch speech such as "four twenty nine", "fifteen sixty two", and "four hundred twenty nine".
function houseNumberFromSpeech(raw){
 const digits={zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
 const teens={ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
 const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 const words=String(raw||'').trim().toLowerCase().replace(/-/g,' ').split(/\s+/);
 const small=w=>digits[w]??teens[w]??tens[w];
 const first=small(words[0]);if(first===undefined)return null;
 let value,consumed;
 if(words[1]==='thousand'){
  value=first*1000;consumed=2;
  if(small(words[2])!==undefined){value+=small(words[2]);consumed=3;if(words[3]==='hundred'){value+=small(words[2])*99;consumed=4;}}
 }else if(words[1]==='hundred'){
  value=first*100;consumed=2;
 }else if(first>=10&&words[1]&&small(words[1])!==undefined){
  const second=small(words[1]);
  if(first>=10&&first<=99&&second>=10&&second<100){value=first*100+second;consumed=2;}
  else if(first<10&&second>=10&&second<100){value=first*100+second;consumed=2;}
  else if(first>=20&&first%10===0&&second<10){value=first+second;consumed=2;}
 }else if(first<10&&words[1]&&small(words[1])!==undefined&&small(words[1])>=10){value=first*100+small(words[1]);consumed=2;}
 if(value===undefined){value=first;consumed=1;}
 if((words[consumed]==='and'))consumed++;
 if((words[consumed]==='hundred')&&consumed===1){value*=100;consumed++;}
 if(value%100===0&&value>=100&&small(words[consumed])!==undefined){value+=small(words[consumed]);consumed++;}
 if(tens[words[consumed-1]]!==undefined&&digits[words[consumed]]!==undefined){value+=digits[words[consumed]];consumed++;}
 if(value<1||value>999999)return null;
 return {number:String(value),words:consumed};
}
function spokenStreetAddress(text){
 const words=String(text||'').trim().replace(/^[,;:.\s]+/,'').split(/\s+/);
 if(!words.length)return '';
 if(/^\d{1,6}$/.test(words[0]))return words.join(' ').replace(/[.!?,;]+$/,'').trim();
 const parsed=houseNumberFromSpeech(words.join(' '));
 if(!parsed||!words[parsed.words]||!/[a-z]/i.test(words[parsed.words]))return '';
 return [parsed.number,...words.slice(parsed.words)].join(' ').replace(/[.!?,;]+$/,'').trim();
}
function create(unit,entry,address,raw,identifier='',remark='',explicit=''){
if(!unit)return {ok:false,message:'One recognized unit is required.'};
if(unit.discipline!==entry.discipline)return {ok:false,message:`${unit.id} is ${unit.discipline}; ${entry.type} requires ${entry.discipline}.`};
const place=window.cadCommonPlaces?.resolve(address);address=place?.address||address;
if(!address||(!place&&!/^\d{1,6}\s+[\w .'-]+/.test(address)))return {ok:false,message:'Unambiguous street address required. Use @address@.'};
if(!['AVAILABLE','CLEAR'].includes(unit.status)||state.incidents.some(i=>i.status==='ACTIVE'&&i.units.includes(unit.id)))return {ok:false,message:`${unit.id} is committed or unavailable; no incident created.`};
const id=`${new Date().getFullYear().toString().slice(-2)}-${String(++state.seq).padStart(6,'0')}`;
const status=explicit||entry.rule.status||'ONSCENE',time=new Date().toLocaleTimeString('en-US',{hour12:false});
const incident={id,agency:unit.agency,discipline:entry.discipline,priority:'P3',type:entry.type,location:address,caller:unit.id,phone:'',narrative:[`${time} [Self initiated] ${raw}`],status:'ACTIVE',units:[unit.id],events:[`${time} SELF_INITIATED ${unit.id} ${entry.type} STATUS ${status}`],plateOrPerson:identifier,remarks:remark,...(place?{commonPlaceName:place.name,commonPlaceId:place.id}:{})};
state.incidents.push(incident);unit.status=status;unit.location=address;delete unit.mapCoords;unit.mapLocationPending=true;state.selected=id;if(place?.coordinates){unit.mapCoords=place.coordinates;unit.mapLocationPending=false;incident.mapCoords=place.coordinates;}else window.cadResolveUnitAddress?.(unit.id,address);return {ok:true,message:`Created ${id} ${entry.type}; ${unit.id} ${status.replace('ONSCENE','ON SCENE')} at ${address}.`}}
function typed(text){const all=entries(),parsed=window.cadStructuredParse?.parse(text,state.units.map(u=>u.id));if(!parsed||parsed.error)return null;
const action=all.find(x=>x.rule.code&&new RegExp('(?:^|\\s)'+x.rule.code+'(?=$|\\s)','i').test(parsed.residual||''));if(!action||['TS','CL'].includes(action.rule.code))return null;
const leftover=(parsed.residual||'').replace(new RegExp('(?:^|\\s)'+action.rule.code+'(?=$|\\s)','i'),'').trim();if(leftover)return {ok:false,message:`Unrecognized text: ${leftover}`};return create(state.units.find(u=>u.id.toUpperCase()===String(parsed.unit).toUpperCase()),action,parsed.address,text,parsed.identifier,parsed.notes)}
function spoken(text){const all=entries(),n=normalize(text);if(!n)return false;
// Ignore optional speech articles within agency-defined CFS names (e.g. 'out with a subject').
const cfsPattern=type=>normalize(type).split(' ').filter(Boolean).join('\\s+(?:(?:a|an|the)\\s+)?');
const matches=all.filter(x=>new RegExp('(?:^|\\s)'+cfsPattern(x.type)+'(?=\\s|$)','i').test(n)).sort((a,b)=>b.type.length-a.type.length);
if(!matches.length)return false;
const e=matches[0];if(matches[1]&&normalize(matches[1].type)===normalize(e.type))return false;
// Resolve unit and location first; then accept common self-initiated phrasing.
// A bare CFS announcement ("3A12 follow up at PHS") is valid when unambiguous.
// Do not steal dispatch instructions, questions, negations, or tentative reports.
const unit=locateUnit(text);if(!unit){const out=document.getElementById('voiceInterpretation');if(out)out.textContent=`HEARD: ${text} | REVIEW: ${e.type} recognized, but the unit was not uniquely identified.`;return true;}
const spokenCfs=cfsPattern(e.type);
const announcement=new RegExp('(?:^|\\s)(?:i\\s*(?:am|m|ll|will)\\s+be\\s+|we\\s*(?:are|re)\\s+|(?:i\\s*am|i\\s*m|i\\s*ll|i\\s*will|we\\s*are|we\\s*re)\\s+|out\\s+(?:at|on|for)\\s+|on\\s+(?:a|an)\\s+|en\\s*route\\s+|heading\\s+to\\s+|initiating\\s+|conducting\\s+)?(?:out\\s+(?:at|on|for)\\s+|on\\s+(?:a|an)\\s+)?'+spokenCfs+'(?:\\s|$)','i');
const hasInitiation=/\b(?:i(?:'m|'ll| am| will)|we(?:'re| are)|out\s+(?:at|on|for)|on\s+(?:a|an)|en\s*route|heading|initiating|conducting)\b/i.test(text)||announcement.test(n);
if(!hasInitiation||/\b(?:dispatch|send|assign|start\s+(?:unit|engine|truck|medic|battalion)|requesting\s+(?:unit|backup)|cancel|not\s+(?:on|going)|possible|maybe)\b/i.test(text))return false;
// Prefer exact Common Place names/aliases anywhere in the transmission.
const places=(window.cadCommonPlaces?.list()||[]).flatMap(p=>[p.name,...p.aliases].filter(Boolean).map(name=>({name,p}))).sort((a,b)=>b.name.length-a.name.length);
const placeMatches=places.filter(({name})=>new RegExp('(?:^|[^a-z0-9])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])','i').test(text));
const uniquePlaces=[...new Set(placeMatches.map(x=>x.p.id))];
if(uniquePlaces.length>1)return false;
const commonName=uniquePlaces.length===1?placeMatches[0].name:null;
// Locate a street suffix, then take the preceding numeric or spoken house number.
// Also accept a comma before the address; dispatchers do not always say "at".
const streetTail=/(?:,\s*|\b(?:at|to|near)\s+)([a-z0-9' -]+?\s+(?:street|st|avenue|ave|road|rd|way|drive|dr|lane|ln|boulevard|blvd|court|ct))\b/gi;
let address='';
if(commonName)address=commonName;
else for(const match of text.matchAll(streetTail)){
 const segment=match[1].replace(/^.*\b(?:at|to|near)\s+(?=(?:\d{1,6}\s|zero\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|eleven\b|twelve\b|thirteen\b|fourteen\b|fifteen\b|sixteen\b|seventeen\b|eighteen\b|nineteen\b|twenty\b|thirty\b|forty\b|fifty\b))/i,'');
 const candidate=spokenStreetAddress(segment);
 if(/^\d{1,6}\s+[a-z]/i.test(candidate))address=candidate;
}

if(!address){const out=document.getElementById('voiceInterpretation');if(out)out.textContent=`HEARD: ${text} | REVIEW: ${e.type} recognized for ${unit.id}, but the location was not recognized. Check Common Places aliases or provide an address.`;return true;}
const explicit=/\b(?:en\s*route|enroute|responding|heading\s+to)\b/i.test(text)?'ENROUTE':/\b(?:on\s*scene|at\s+scene)\b/i.test(text)?'ONSCENE':'';
const r=create(unit,e,address,text,'','',explicit);const out=document.getElementById('voiceInterpretation');if(out)out.textContent=`HEARD: ${text} | ${r.ok?'APPLIED':'REVIEW'}: ${r.message}`;
if(typeof save==='function')save();return true}
const preceding=window.cadBeforeVoiceProcess;window.cadBeforeVoiceProcess=(text,source)=>{
 // Existing Traffic Stop handling preserves vehicle/plate extraction.
 if(!/\btraffic\s+stop\b/i.test(text)&&spoken(text))return true;
 return preceding?.(text,source)===true
};
window.cadSelfInitiated={typed,spoken,entries};
})();
