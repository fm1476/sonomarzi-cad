/* Agency phrase dictionary, pure and non-executing. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadAgencyPhrases=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function normalize(value){return String(value??'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
 function compile(entries){
  const phrases=new Map(),conflicts=new Set();
  for(const entry of Array.isArray(entries)?entries:[]){
   if(!entry||typeof entry.intent!=='string'||!entry.intent.trim())continue;
   const intent=entry.intent.trim();
   for(const raw of Array.isArray(entry.phrases)?entry.phrases:[]){
    const phrase=normalize(raw);
    if(!phrase)continue;
    const prior=phrases.get(phrase);
    if(prior&&prior!==intent){conflicts.add(phrase);phrases.delete(phrase);}
    else if(!conflicts.has(phrase))phrases.set(phrase,intent);
   }
  }
  return Object.freeze({
   resolve(raw){
    const phrase=normalize(raw);
    if(!phrase)return {status:'unknown'};
    if(conflicts.has(phrase))return {status:'ambiguous',phrase};
    const intent=phrases.get(phrase);
    return intent?{status:'matched',intent,phrase}:{status:'unknown',phrase};
   },
   conflicts:Object.freeze([...conflicts])
  });
 }
 return Object.freeze({normalize,compile});
});
