/* Accessible combined-event discipline/type picker. Integration is opt-in.
 * Usage: CadCombinedEventPicker.mount(element,{typesByDiscipline,onSubmit});
 * onSubmit receives validated selections; it must use authenticated server RPCs.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadCombinedEventPicker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const disciplines=['LAW','FIRE','EMS'];
 function validate(selections,typesByDiscipline){
  if(!Array.isArray(selections)||!selections.length)throw Error('Choose at least one discipline');
  const seen=new Set();
  return selections.map(item=>{
   const discipline=String(item.discipline||'').toUpperCase();
   const type=String(item.type||'').trim();
   if(!disciplines.includes(discipline)||seen.has(discipline))throw Error('Invalid or duplicate discipline');
   seen.add(discipline);
   if(!(typesByDiscipline[discipline]||[]).includes(type))throw Error('Choose an agency-configured CFS type for '+discipline);
   return {discipline,type};
  });
 }
 function mount(container,{typesByDiscipline={},onSubmit}={}){
  if(!container||typeof document==='undefined')throw Error('Browser container required');
  if(typeof onSubmit!=='function')throw Error('Submit handler required');
  const form=document.createElement('form');
  form.className='cad-combined-picker';
  const heading=document.createElement('h3');heading.textContent='Combined Event';form.append(heading);
  const controls=[];
  for(const discipline of disciplines){
   const row=document.createElement('div');row.className='cad-combined-picker-row';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='combined-'+discipline;
   const label=document.createElement('label');label.htmlFor=checkbox.id;label.textContent=discipline;
   const select=document.createElement('select');select.setAttribute('aria-label',discipline+' CFS type');
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select '+discipline+' CFS type';select.append(placeholder);
   for(const type of typesByDiscipline[discipline]||[]){
    const option=document.createElement('option');option.value=type;option.textContent=type;select.append(option);
   }
   select.disabled=true;checkbox.addEventListener('change',()=>{select.disabled=!checkbox.checked;});
   row.append(checkbox,label,select);form.append(row);controls.push({discipline,checkbox,select});
  }
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Review linked calls';form.append(submit);
  const error=document.createElement('p');error.setAttribute('role','alert');form.append(error);
  form.addEventListener('submit',async event=>{
   event.preventDefault();error.textContent='';
   try{
    const selected=validate(controls.filter(c=>c.checkbox.checked).map(c=>({discipline:c.discipline,type:c.select.value})),typesByDiscipline);
    submit.disabled=true;
    try{await onSubmit(selected);}finally{submit.disabled=false;}
   }catch(err){error.textContent=err.message||'Unable to review linked calls';}
  });
  container.replaceChildren(form);
  return {destroy:()=>form.remove()};
 }
 return Object.freeze({validate,mount});
});
