/* Optional fictional Petaluma calls, added only on deliberate dispatcher request.
 * Never reset units, incident history or authentication state.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 const button=root.document.getElementById('cadLoadSampleCalls');
 if(!button)return;
 button.addEventListener('click',async()=>{
  if(button.disabled)return;
  const samples=api.selectMissing(root.cadSafetyState?.()?.incidents||root.state?.incidents||[]);
  if(!samples.length){root.alert('All six sample calls are already present. No records changed.');return;}
  if(!root.confirm('Create '+samples.length+' fictional sample calls around Petaluma? Existing calls and unit assignments will not be changed.'))return;
  button.disabled=true;const original=button.textContent;button.textContent='Creating sample calls…';
  let completed=0;
  try{
   if(root.cadSharedIsActive?.()){
    if(typeof root.cadSharedCommand!=='function')throw Error('Shared CAD command gateway unavailable.');
    for(const item of samples){
     // The authenticated shared command creates a pending incident without unit assignment.
     await root.cadSharedCommand('create',{discipline:item.discipline,type:item.type,priority:item.priority,location:item.location});
     completed++;
    }
   }else{
    completed=root.cadAddLocalSampleCalls(samples);
   }
   root.alert('Created '+completed+' sample calls. Existing calls and unit assignments were preserved.');
  }catch(err){root.alert('Created '+completed+' of '+samples.length+' requested calls. '+err.message+' Review the board before trying again.');}
  finally{button.disabled=false;button.textContent=original;}
 });
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=Object.freeze([
  Object.freeze({discipline:'FIRE',type:'Fire Alarm',priority:'P2',location:'900 Lakeville Street, Petaluma, CA',agency:'Petaluma Fire / EMS'}),
  Object.freeze({discipline:'EMS',type:'Medical Aid',priority:'P2',location:'600 East Washington Street, Petaluma, CA',agency:'Petaluma Fire / EMS'}),
  Object.freeze({discipline:'LAW',type:'Traffic Collision',priority:'P2',location:'101 Fourth Street, Petaluma, CA',agency:'Petaluma Police'}),
  Object.freeze({discipline:'LAW',type:'Welfare Check',priority:'P3',location:'125 Petaluma Boulevard North, Petaluma, CA',agency:'Petaluma Police'}),
  Object.freeze({discipline:'LAW',type:'Suspicious Person',priority:'P3',location:'400 D Street, Petaluma, CA',agency:'Petaluma Police'}),
  Object.freeze({discipline:'LAW',type:'Burglary Alarm',priority:'P2',location:'200 Kentucky Street, Petaluma, CA',agency:'Petaluma Police'})
 ]);
 const normal=s=>String(s||'').toLowerCase().replace(/\b(street|st)\b/g,'st').replace(/\b(avenue|ave)\b/g,'ave').replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
 function selectMissing(existing){
  const records=Array.isArray(existing)?existing:[];
  return catalog.filter(item=>!records.some(i=>i.status!=='CLOSED'&&normal(i.type)===normal(item.type)&&normal(i.location||i.current_location)===normal(item.location)));
 }
 return Object.freeze({catalog,selectMissing});
});
