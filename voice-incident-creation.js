/* Voice incident creation for the hackathon prototype. Never uses an LLM to mutate CAD records. */
(()=>{'use strict';
 const priorVoiceHandler=window.cadBeforeVoiceProcess;
 const norm=s=>String(s||'').toLowerCase().replace(/\b(?:atom|addam)\b/g,'adam').replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine)\s+item\s+(?=\d+|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|eleven\b|twelve\b|thirteen\b|fourteen\b|fifteen\b|sixteen\b|seventeen\b|eighteen\b|nineteen\b|twenty\b|thirty\b|forty\b|fifty\b)/g,'$1 adam ').replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim();
 const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stopWords=/\b(?:vehicle|veh|blue|black|white|gray|grey|silver|red|green|brown|toyota|toyoate|honda|ford|chevy|chevrolet|4\s*runner|four\s*runner|license|licence|plate|registration|california|ca)\b/i;
 const numberWords={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',twelve:'12',thirteen:'13',fourteen:'14',fourteens:'14',twenty:'20'};
 const wordDigits=s=>String(s).replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|thirteen|fourteen|fourteens|twenty)\b/gi,w=>({...numberWords,twelve:'12'})[w.toLowerCase()]||w);
 // Recognize a spoken four-digit street address such as 'fifteen sixty-two' as 1562.
 // Restrict this conversion to address text after the recognized traffic-stop phrase.
 const spokenAddress=s=>String(s).replace(/\b(fifteen|fourteen|thirteen|sixteen|seventeen|eighteen|nineteen)\s+(sixty|fifty|forty|thirty|twenty|seventy|eighty|ninety)[ -]?(one|two|three|four|five|six|seven|eight|nine|[1-9])?\b/gi,(_,a,b,c)=>{
  const hundreds={thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
  const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const ones={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
  return String(hundreds[a.toLowerCase()]*100+tens[b.toLowerCase()]+(ones[c?.toLowerCase()]||Number(c)||0));
 });
 const toUnit=(raw)=>{
  const t=wordDigits(norm(raw)).replace(/(\d)\s*(adam|alpha)\s*(?=\d)/gi,'$1a').replace(/\b(?:adam|alpha|out of)\b/g,'a').replace(/\b(?:boy|bravo)\b/g,'b').replace(/\s+/g,'');
  const lead=t.match(/^(\d+)a(\d+)/);if(lead)return lead[1]+'A'+lead[2];
  const short=t.match(/^(\d{2,5})$/);if(short){const matching=state.units.filter(u=>{const m=u.id.match(/^(\d+)[A-Z](\d+)$/);return m&&m[1]+m[2]===short[1]});if(matching.length===1)return matching[0].id;}
  return String(raw||'').toUpperCase();
 };
 function typeMatches(raw,discipline){
  const types=(config.types?.[discipline]||[]).map(x=>String(x).trim()).filter(Boolean);
  const compact=s=>norm(s).replace(/[^a-z0-9]/g,'');
  const found=types.filter(type=>compact(type)===compact(raw));
  return found.length===1?found[0]:null;
 }
 function identifyType(text){
  const s=norm(text);let matches=[];
  for(const discipline of ['LAW','FIRE','EMS'])for(const type of config.types?.[discipline]||[]){
   const words=norm(type).split(' '), pattern=words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
   if(new RegExp('(?:^|\\b)'+pattern+'(?:\\b|$)','i').test(s))matches.push({type,discipline});
  }
  if(/\btraffic\s+stop\b/.test(s)&&!matches.some(x=>norm(x.type)==='traffic stop')){
   const custom=typeMatches('Traffic Stop','LAW');if(custom)matches.push({type:custom,discipline:'LAW'});
  }
  matches.sort((a,b)=>b.type.length-a.type.length);
  return matches[0]||null;
 }
 function feedback(text,result,kind='REVIEW'){
  const heard=document.getElementById('voiceHeard'),out=document.getElementById('voiceInterpretation');
  if(heard)heard.textContent=text;
  if(out)out.textContent=`HEARD: ${text} | ${kind}: ${result}`;
  state.voiceActivity ||= [];state.voiceActivity.unshift(`${new Date().toLocaleTimeString('en-US',{hour12:false})} VOICE ${kind}: ${result}`);
  if(typeof save==='function')save();
 }
 const makeIncident=(text,unit,kind,type,address,vehicle,plate)=>{
  const status=unit.status;
  if(!['AVAILABLE','CLEAR'].includes(status)){feedback(text,`${unit.id} is ${status}; dispatch held. No incident created.`);return true;}
  const existing=state.incidents.filter(i=>i.status==='ACTIVE'&&i.units.includes(unit.id));
  if(existing.length){feedback(text,`${unit.id} already assigned to ${existing.map(i=>i.id).join(', ')}. No duplicate created.`);return true;}
  const year=String(new Date().getFullYear()).slice(-2), id=`${year}-${String(++state.seq).padStart(6,'0')}`;
  const time=new Date().toLocaleTimeString('en-US',{hour12:false});
  const incident={id,agency:unit.agency,discipline:kind,priority:'P3',type,location:address,caller:unit.id,phone:'',narrative:[`${time} [Field initiated] ${text}`],status:'ACTIVE',units:[unit.id],events:[`${time} VOICE_FIELD_INITIATED ${unit.id} ${type} at ${address}`],radioTranscripts:[{id:'field'+Date.now(),time,source:'FIELD',text,units:[unit.id],status:'DISPATCHED',incidentId:id}],voiceNotes:[],vehicle:vehicle||null,plate:plate||null};
  if(vehicle)incident.events.push(`${time} VEHICLE_DESCRIPTION ${vehicle}`);
  if(plate)incident.events.push(`${time} VEHICLE_PLATE ${plate}`);
  state.incidents.push(incident);unit.status=(config.selfInitiated?.[kind]?.[type]?.status||'ONSCENE');unit.location=address;incident.events.push(`${time} VOICE_UNIT_STATUS ${unit.id} ${unit.status}`);
  state.selected=id;feedback(text,`Created ${id} (${type}), ${address}; ${unit.id} on scene${vehicle?'; vehicle '+vehicle:''}${plate?'; plate '+plate:''}`,'APPLIED');return true;
 };
 // This optional hook executes before existing voice routing, leaving other workflows unchanged.
 window.cadBeforeVoiceProcess=(text,source)=>{
  const raw=String(text||'').trim();const s=norm(raw);
  if(!raw||/\b(?:cancel|disregard|do not|don't|negative)\b/.test(s))return false;
  // Field-initiated traffic stop: unit, call type, street number and street required.
  const traffic=/^(?:copy\s+)?((?:\d+\s*(?:adam|alpha|a|out of)\s*\d+|\d+[a-z]\d+|\d{2,5}))(?:['’]s)?[\s,.:;]+(?:(?:is\s+)?on\s+(?:a\s+)?)?traffic\s+stop\b[,.:;\s]*(?:at\s+)?(.+)$/i.exec(wordDigits(norm(raw)));
  if(traffic){
   if(priorVoiceHandler?.(text,source)===true)return true;
   const unitId=toUnit(traffic[1]),unit=state.units.find(u=>u.id.toUpperCase()===unitId.toUpperCase());
   if(!unit){feedback(raw,`Unrecognized unit ${unitId}; no event created.`);return true;}
   if(unit.discipline!=='LAW'){feedback(raw,`${unit.id} is ${unit.discipline}; Traffic Stop requires LAW.`);return true;}
   if(config.selfInitiated?.LAW?.['Traffic Stop']?.enabled===false){feedback(raw,'Traffic Stop self-initiation is disabled in Configuration.');return true;}
   const kind=typeMatches('Traffic Stop','LAW');
   if(!kind){feedback(raw,'Traffic Stop is not in configured LAW call types. Add it in Configuration and save, then retry.');return true;}
   const body=spokenAddress(traffic[2]);
   const address=body.match(/^((?:\d{1,6})\s+(?:[a-z]+\s+){0,4}?(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way))\b/i);
   if(!address){feedback(raw,'No unambiguous street address identified. Say unit, Traffic Stop, house number and street.');return true;}
   const remaining=body.slice(address[0].length).trim();
   // Decode clearly framed phonetic plates after 'California', 'CA', or 'plate'.
   // Unknown or ambiguous fragments are preserved for review, never guessed.
   const phonetic={adam:'A',alpha:'A',boy:'B',bravo:'B',charles:'C',charlie:'C',david:'D',delta:'D',edward:'E',echo:'E',frank:'F',foxtrot:'F',george:'G',golf:'G',henry:'H',hotel:'H',ida:'I',india:'I',john:'J',juliet:'J',king:'K',kilo:'K',lincoln:'L',lima:'L',mary:'M',mike:'M',nora:'N',november:'N',ocean:'O',oscar:'O',paul:'P',papa:'P',queen:'Q',quebec:'Q',robert:'R',romeo:'R',sam:'S',sierra:'S',tom:'T',tango:'T',union:'U',uniform:'U',victor:'V',victoria:'V',william:'W',whiskey:'W',xray:'X',yankee:'Y',zebra:'Z',zulu:'Z',zero:'0',oh:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
   const plateStart=/\b(?:ca|california|(?:license\s+)?plate)\s+(?:(?:license\s+)?plate\s+)?/ig;
   let plate='', plateText='';
   for(const start of remaining.matchAll(plateStart)){
    const tail=remaining.slice(start.index+start[0].length).replace(/^[\s:,-]+/,'');
    const chunks=tail.match(/^[a-z0-9]+(?:[\s-]+[a-z0-9]+){0,10}/i)?.[0]||'';
    const tokens=chunks.split(/[\s-]+/).filter(Boolean);
    let combined='',consumed=0;
    for(const token of tokens){
     const part=phonetic[token.toLowerCase()]||(/^([a-z0-9]{1,9})$/i.test(token)&&(/\d/.test(token)||token.length===1)?token.toUpperCase():'');
     if(!part||combined.length+part.length>9)break;
     combined+=part;consumed++;
    }
    if(combined.length>=4&&combined.length<=9&&/\d/.test(combined)&&/[A-Z]/.test(combined)){
     plate=combined;plateText=remaining.slice(start.index,start.index+start[0].length+tokens.slice(0,consumed).join(' ').length);break;
    }
   }
   const description=remaining.replace(plateText,'').replace(/\b(?:vehicle|veh)\b/gi,'').trim().replace(/\btoyoate\b/gi,'Toyota').replace(/\bfour\s+runner\b/gi,'4Runner').replace(/\b4[ -]?runner\b/gi,'4Runner').replace(/^[,.; ]+|[,.; ]+$/g,'');
   return makeIncident(raw,unit,'LAW',kind,address[1].trim(),description,plate);
  }
  return priorVoiceHandler?.(text,source)===true;
 };
 // Shared dynamic type resolver consumed by reclassification rules and tests.
 window.cadConfiguredVoiceType={identifyType,typeMatches};
})();
