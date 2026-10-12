/* Browser-local, non-executing agency phrase preview. */
(function(){
 'use strict';
 const KEY='smcad-agency-phrase-preview-v1';
 const field=document.getElementById('cadPhraseJson');
 const output=document.getElementById('cadPhraseResult');
 const button=document.getElementById('cadPhraseValidate');
 if(!field||!output||!button||!window.CadAgencyPhrases)return;
 const example=[{intent:'unit.available',phrases:['show available units','list available units']}];
 field.value=localStorage.getItem(KEY)||JSON.stringify(example,null,2);
 button.addEventListener('click',()=>{
  try{
   const entries=JSON.parse(field.value);
   if(!Array.isArray(entries))throw new Error('Provide a JSON array of intent definitions.');
   if(entries.length>100)throw new Error('Limit this preview to 100 intent definitions.');
   for(const item of entries){
    if(!item||typeof item.intent!=='string'||!item.intent.trim()||!Array.isArray(item.phrases)||item.phrases.some(p=>typeof p!=='string'))throw new Error('Each entry needs a nonempty intent and a phrases array of strings.');
   }
   const dictionary=window.CadAgencyPhrases.compile(entries);
   if(dictionary.conflicts.length){
    output.textContent='Not saved. Conflicting phrases: '+dictionary.conflicts.join(', ');
    return;
   }
   localStorage.setItem(KEY,JSON.stringify(entries));
   output.textContent='Preview saved locally. No operational CAD actions are connected to this dictionary.';
  }catch(error){output.textContent='Not saved: '+error.message;}
 });
})();
