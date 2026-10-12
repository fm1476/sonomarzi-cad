/* Contextual ASR repair: interpret "unseen" as on-scene only after an explicit callsign. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadRadioStatusRepair=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function repair(text,hasExplicitUnit){
  const value=String(text??'');
  if(!hasExplicitUnit)return value;
  const t=value.toLowerCase();
  if(/\b(?:not|never|don't|do not|cancel|disregard)\b/.test(t))return value;
  // Avoid repairing ordinary speech such as "the suspect was unseen".
  const callSign=/^\s*(?:(?:dispatch|radio|unit)\s+)?(?:\d+[a-z]\d+|\d+\s+(?:adam|alpha|a|out of|outta|addam|boy|bravo|b)\s+\d+|\d{2,5})\s*[,.:]?\s+(?:(?:show(?:\s+me)?|mark|status|we(?:'re| are)|i(?:'m| am))\s+)?unseen\s*[.!]?\s*$/i;
  return callSign.test(value)?value.replace(/\bunseen\b/i,'on scene'):value;
 }
 return Object.freeze({repair});
});
