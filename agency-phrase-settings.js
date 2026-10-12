/* Browser-local agency phrase editor; does not execute CAD commands. */
(function(){
 'use strict';
 const KEY='smcad-agency-phrase-preview-v1';
 const byId=id=>document.getElementById(id);
 const field=byId('cadPhraseJson'),output=byId('cadPhraseResult'),save=byId('cadPhraseValidate');
 const intent=byId('cadPhraseIntent'),aliases=byId('cadPhraseAliases'),list=byId('cadPhraseList');
 const add=byId('cadPhraseAdd'),test=byId('cadPhraseTest'),testButton=byId('cadPhraseTestButton'),applyJson=byId('cadPhraseApplyJson');
 if(!field||!output||!save||!intent||!aliases||!list||!add||!test||!testButton||!applyJson||!window.CadAgencyPhrases)return;
 const example=[{intent:'unit.available',phrases:['show available units','list available units']}];
 let entries;
 try{entries=JSON.parse(localStorage.getItem(KEY)||JSON.stringify(example));if(!Array.isArray(entries))entries=example;}catch(_){entries=example;}
 const known=new Set([...intent.options].map(o=>o.value));
 function validate(items){
  if(!Array.isArray(items)||items.length>100)throw new Error('Provide up to 100 phrase groups.');
  const seenIntents=new Set();
  for(const item of items){
   if(!item||!known.has(item.intent)||!Array.isArray(item.phrases)||!item.phrases.length||item.phrases.length>100||item.phrases.some(p=>typeof p!=='string'||!p.trim()||p.length>160))throw new Error('Use a listed CAD action and 1 to 100 nonempty phrases, up to 160 characters each.');
   if(seenIntents.has(item.intent))throw new Error('Each CAD action may appear only once.');
   seenIntents.add(item.intent);
  }
  const dictionary=window.CadAgencyPhrases.compile(items);
  if(dictionary.conflicts.length)throw new Error('Conflicting phrases: '+dictionary.conflicts.join(', '));
  return dictionary;
 }
 function sync(){
  field.value=JSON.stringify(entries,null,2);
  list.replaceChildren();
  for(const item of entries){
   const row=document.createElement('div');
   const label=document.createElement('span');
   label.textContent=item.intent+': '+item.phrases.join(' · ')+' ';
   const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
   edit.addEventListener('click',()=>{intent.value=item.intent;aliases.value=item.phrases.join('\n');});
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';
   remove.addEventListener('click',()=>{entries=entries.filter(x=>x!==item);sync();output.textContent='Unsaved changes. Validate and save when ready.';});
   row.append(label,edit,remove);list.append(row);
  }
 }
 add.addEventListener('click',()=>{
  const phrases=[...new Set(aliases.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  if(!phrases.length){output.textContent='Enter at least one spoken phrase.';return;}
  const existing=entries.find(x=>x.intent===intent.value);
  const next=entries.filter(x=>x.intent!==intent.value).concat([{intent:intent.value,phrases:[...new Set([...(existing?.phrases||[]),...phrases])]}]);
  try{validate(next);entries=next;sync();output.textContent='Phrases added to preview. Existing phrases preserved. Save when ready.';}
  catch(e){output.textContent='Not added: '+e.message;}
 });
 testButton.addEventListener('click',()=>{
  try{const dictionary=validate(entries);const result=window.CadCommandGate.evaluate(dictionary.resolve(test.value));output.textContent=result.status==='recognized'?'Recognized: '+result.intent+'. Preview only, no action executed.':result.status==='needs_context'?'Recognized '+result.intent+' but requires '+result.required.join(', ')+'. No action executed.':'Rejected: '+result.reason+'. No action executed.';}
  catch(e){output.textContent='Cannot test: '+e.message;}
 });
 applyJson.addEventListener('click',()=>{
  try{const next=JSON.parse(field.value);validate(next);entries=next;sync();output.textContent='JSON loaded into editor. Save when ready.';}
  catch(e){output.textContent='Not loaded: '+e.message;}
 });
 save.addEventListener('click',()=>{
  try{validate(entries);localStorage.setItem(KEY,JSON.stringify(entries));sync();output.textContent='Saved in this browser. No operational CAD actions are connected.';}
  catch(e){output.textContent='Not saved: '+e.message;}
 });
 sync();
})();
