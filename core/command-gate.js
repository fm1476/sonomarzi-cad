/* Pure, non-executing command recognition decision gate. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadCommandGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const allowed=new Set(['unit.available','unit.unavailable','incident.clear','map.hydrants','map.schools']);
 const operational=new Set(['incident.clear']);
 function evaluate(recognition,context){
  if(!recognition||recognition.status!=='matched')return Object.freeze({status:'rejected',reason:recognition?.status||'unknown'});
  if(!allowed.has(recognition.intent))return Object.freeze({status:'rejected',reason:'unsupported_intent'});
  if(operational.has(recognition.intent)&&!context?.incidentId)return Object.freeze({status:'needs_context',intent:recognition.intent,required:['incidentId']});
  return Object.freeze({status:'recognized',intent:recognition.intent,executionAllowed:false});
 }
 return Object.freeze({evaluate});
});
