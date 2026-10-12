/* Pure, non-executing command recognition decision gate. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadCommandGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=(typeof require==='function'?require('./intent-catalog.js').catalog:globalThis.CadIntentCatalog.catalog);
 function evaluate(recognition,context){
  if(!recognition||recognition.status!=='matched')return Object.freeze({status:'rejected',reason:recognition?.status||'unknown'});
  if(!Object.hasOwn(catalog,recognition.intent))return Object.freeze({status:'rejected',reason:'unsupported_intent'});
  const missing=catalog[recognition.intent].required.filter(key=>typeof context?.[key]!=='string'||!context[key].trim());
  if(missing.length)return Object.freeze({status:'needs_context',intent:recognition.intent,required:missing});
  return Object.freeze({status:'recognized',intent:recognition.intent,executionAllowed:false});
 }
 return Object.freeze({evaluate});
});
