/* Pure guard for incomplete ASR status utterances. Never guesses a status. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadRadioIncomplete=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function inspect(text,uniqueUnit){
  if(!uniqueUnit)return null;
  const s=String(text??'').toLowerCase().trim().replace(/[.!?]+$/,'');
  const callsign=/^(?:(?:dispatch|radio|unit)\s+)?(?:\d+[a-z]\d+|\d+\s+(?:adam|alpha|a|out of|outta|addam|boy|bravo|b)\s+\d+|\d{2,5})\s*(?:(?:is|we(?:'re| are)|i(?:'m| am)|show(?:\s+me)?|mark|status|show(?:\s+me)?\s+on))?$/;
  return callsign.test(s)?Object.freeze({reason:'Incomplete radio status command. Please repeat the status; no change applied.'}):null;
 }
 return Object.freeze({inspect});
});
