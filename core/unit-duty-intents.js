/* Parse explicit on-duty radio logons against configured master unit definitions. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadUnitDutyIntents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const words={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20'};
 function canonical(value){return String(value||'').toLowerCase().replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g,w=>words[w]).replace(/\b(?:adam|alpha)\b/g,'a').replace(/\b(?:boy|bravo)\b/g,'b').replace(/\b(?:engine)\b/g,'e').replace(/\b(?:medic)\b/g,'m').replace(/\b(?:rescue)\b/g,'r').replace(/\b(?:truck)\b/g,'t').replace(/\b(?:battalion)\b/g,'b').replace(/\b(?:unit)\b/g,'').replace(/[^a-z0-9]+/g,'');}
 function intent(text){
  const t=String(text||'').trim();
  if(/\b(?:do not|don't|not|cancel|disregard|scratch|negative)\b/i.test(t))return null;
  const parts=[
   /^\s*(?:i(?:'m| am)\s+)?(?:logging|log|signing|sign)\s+(?:myself\s+)?(?:on|in)(?:\s+duty|\s+service)?\s+(.+?)\s*[.!]?$/i,
   /^\s*(?:show|mark|put)\s+(.+?)\s+(?:on\s+duty|in\s+service)\s*[.!]?$/i,
   /^\s*(.+?)\s+(?:logging|signing|log|sign)\s+(?:on|in)(?:\s+duty|\s+service)?\s*[.!]?$/i,
   /^\s*(.+?)\s+(?:on\s+duty|in\s+service)\s*[.!]?$/i
  ];
  for(const pattern of parts){const m=t.match(pattern);if(m){const target=m[1].trim();if(target)return {action:'LOG_ON',target};}}
  return null;
 }
 function resolve(text,units){
  const parsed=intent(text);if(!parsed)return {kind:'NONE'};
  const key=canonical(parsed.target);
  const matches=(units||[]).filter(u=>canonical(u.designator)===key);
  if(matches.length===1)return {kind:'LOG_ON',unit:matches[0],target:parsed.target};
  return {kind:'REVIEW',reason:matches.length?'Multiple configured units match '+parsed.target:'No configured unit matches '+parsed.target+'. Add it under Agencies & Units first.'};
 }
 return Object.freeze({canonical,intent,resolve});
});