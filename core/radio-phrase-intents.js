/* Read-only classification of common public safety radio phrases.
 * These are intents, not commands to create incidents or change statuses.
 * Agency-configured incident types and active assignment must be resolved separately.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadRadioPhraseIntents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=Object.freeze([
  {id:'SUBJECT_CONTACT',label:'Out with subject',requires:['unit','location or existing incident'],
   variants:[/\b(?:out|outside)\s+with\s+(?:a\s+|the\s+|one\s+|two\s+|three\s+)?(?:subject|suspect|person|individual|party)\b/,/\b(?:subject|pedestrian)\s+(?:contact|stop)\b/]},
  {id:'FOLLOW_UP',label:'Follow-up',requires:['unit','related incident or location'],
   variants:[/\bfollow[ -]?up\b/,/\bfollowing\s+up\b/,/\b(?:returning|going back)\s+to\s+(?:the\s+)?(?:call|incident|location)\b/]}
 ]);
 function classify(text){
  const value=String(text||'').toLowerCase().replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim();
  if(/\b(?:cancel|disregard|never|do not|don't|negative|not)\b/.test(value))return null;
  const matches=catalog.filter(intent=>intent.variants.some(regex=>regex.test(value)));
  return matches.length===1?{id:matches[0].id,label:matches[0].label,requires:matches[0].requires}:null;
 }
 return Object.freeze({catalog,classify});
});
