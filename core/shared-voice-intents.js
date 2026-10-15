/* Deterministic, side-effect-free voice intent classification for Supabase CAD.
 * A parsed request is NOT permission to mutate data: the shared command gateway
 * and authoritative refreshed snapshot must independently validate it.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadSharedVoiceIntents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function normalize(s){return String(s||'').toLowerCase().replace(/[.,!?$]/g,' ').replace(/\s+/g,' ').trim();}
 function classify(text){
  const t=normalize(text);
  if(/\b(?:do not|don't|not|never|cancel|disregard|negative|hold off|preempt)\b/.test(t))return {kind:'REVIEW',reason:'Negated or sensitive command requires operator review'};
  if(/\b(?:traffic stop|out with (?:a |the )?(?:subject|person|party)|follow[ -]?up)\b/.test(t))
   return {kind:'REVIEW',reason:'Self-initiated or follow-up incident creation is not yet a verified atomic shared transaction'};
  if(/\b(?:code\s*(?:4|four|for)|c\s*4)\b/.test(t))return {kind:'STATUS',status:'CODE4'};
  if(/\b(?:on\s*(?:the\s*)?scene|at\s*(?:the\s*)?scene|on\s*scene|10\s*97|ten\s*ninety\s*seven)\b/.test(t))return {kind:'STATUS',status:'ONSCENE'};
  if(/\b(?:en\s*route|in\s*route|on\s*route|in\s*root|enroute|responding|10\s*76)\b/.test(t))return {kind:'STATUS',status:'ENROUTE'};
  if(/\b(?:clear|cleared|10\s*8|ten\s*eight)\b/.test(t))return {kind:'CLEAR'};
  return {kind:'REVIEW',reason:'No supported shared radio status identified'};
 }
 function unitList(text,units,voiceText){
  const raw=String(text||''),t=normalize(raw).replace(/\b(\d{1,3})(st|nd|rd|th)\b/g,'$1');
  const ids=new Set(voiceText.numericCallsigns(raw));
  const numberNames={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15};
  const typeCode={engine:'E',medic:'M',ambulance:'M',truck:'T',ladder:'T',battalion:'B',rescue:'R'};
  const valid=Array.isArray(units)?units:[];
  const mentions=[];
  const explicit=/\b(engine|medic|ambulance|truck|ladder|battalion|rescue)\s+(\d{1,3}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\b/gi;
  for(const hit of t.matchAll(explicit)){
   const numeric=/^\d+$/.test(hit[2])?Number(hit[2]):numberNames[hit[2]];
   const id=typeCode[hit[1].toLowerCase()]+numeric;
   if(valid.some(u=>String(u.id).toUpperCase()===id))mentions.push(id);
  }
  // ASR can hear "Engine One" as "engine wanted coffee". Repair ONLY when
  // accompanied by an explicit working-fire/on-scene phrase and roster E1.
  if(/\bengine wanted coffee\b/.test(t)&&/\b(?:on|at) (?:the )?scene\b/.test(t)&&/\bconfirmed working (?:structure )?fire\b/.test(t)
    &&valid.some(u=>String(u.id).toUpperCase()==='E1'))mentions.push('E1');
  // Standard concise apparatus IDs (E1/M2/T1/R1) used in radio transcripts.
  for(const hit of t.matchAll(/\b(e|m|t|b|r|so)\s*(\d{1,3})\b/gi)){
   const id=hit[1].toUpperCase()+Number(hit[2]);
   if(valid.some(u=>String(u.id).toUpperCase()===id))mentions.push(id);
  }
  for(const id of ids)if(valid.some(u=>String(u.id).toUpperCase()===id))mentions.push(id);
  const flattened=t.match(/^\s*(?:dispatch|radio|unit|show|mark)?\s*(\d{2,6})\b/);
  if(flattened){
   for(const u of valid){
    const m=String(u.id).toUpperCase().match(/^(\d+)[A-Z](\d+)$/);
    if(m&&m[1]+m[2]===flattened[1])mentions.push(String(u.id).toUpperCase());
   }
  }
  const expanded=t.replace(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine)\s+(?:out of|outta)\s+(\d{1,3})\b/g,(_,n,m)=>String((numberNames[n]??Number(n)))+' adam '+m);
  for(const id of voiceText.numericCallsigns(expanded))if(valid.some(u=>String(u.id).toUpperCase()===id))mentions.push(id);
  return [...new Set(mentions)].map(id=>valid.find(u=>String(u.id).toUpperCase()===id));
 }
 function callsigns(text,units,voiceText){
  const matches=unitList(text,units,voiceText);
  return matches.length===1?matches[0]:null;
 }
 function legacyCallsigns(text,units,voiceText){
  const raw=String(text||'');
  const ids=new Set(voiceText.numericCallsigns(raw));
  const t=normalize(raw).replace(/\b(\d{1,2})(st|nd|rd|th)\b/g,'$1');
  // Flattened 314 or $314 is ambiguous unless exactly one roster unit matches.
  const head=t.match(/^(?:(?:dispatch|radio|unit|show|mark)\s+)?(\d{2,6})\b/);
  if(head)for(const u of units){
   const p=String(u.id||'').toUpperCase().match(/^(\d+)[A-Z](\d+)$/);
   if(p&&p[1]+p[2]===head[1])ids.add(u.id.toUpperCase());
  }
  // "three out of 14th" -> 3A14, only when first segment and suffix are clear.
  const expanded=t.replace(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine)\s+(?:out of|outta)\s+(\d{1,3})\b/g,(_,n,m)=>String(({one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9})[n]||Number(n))+' adam '+m);
  for(const id of voiceText.numericCallsigns(expanded))ids.add(id);
  const matched=units.filter(u=>ids.has(String(u.id||'').toUpperCase()));
  return matched.length===1?matched[0]:null;
 }
 return Object.freeze({classify,callsigns,unitList});
});
