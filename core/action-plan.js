/* Pure CAD action planner. Does not mutate state or execute commands. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadActionPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=(typeof require==='function'?require('./intent-catalog.js').catalog:globalThis.CadIntentCatalog.catalog);
 function plan(decision,context={},permissions=[]){
  if(!decision||!['recognized','needs_context'].includes(decision.status))return Object.freeze({status:'rejected',reason:'invalid_recognition'});
  const definition=catalog[decision.intent];
  if(!definition)return Object.freeze({status:'rejected',reason:'unsupported_intent'});
  const missing=definition.required.filter(key=>typeof context[key]!=='string'||!context[key].trim());
  if(missing.length)return Object.freeze({status:'needs_context',intent:decision.intent,required:missing});
  if(!Array.isArray(permissions)||!permissions.includes(definition.permission))return Object.freeze({status:'denied',intent:decision.intent,reason:'missing_permission'});
  const parameters=Object.fromEntries(definition.required.map(key=>[key,context[key].trim()]));
  return Object.freeze({
   status:definition.confirmation?'needs_confirmation':'planned',
   intent:decision.intent,
   kind:definition.kind,
   permission:definition.permission,
   parameters:Object.freeze(parameters),
   executionAllowed:false
  });
 }
 return Object.freeze({catalog,plan});
});
