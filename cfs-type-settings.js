/* Read-only agency CFS overview. All edits belong to the visual designer. */
(()=>{'use strict';
const host=document.getElementById('cadAgencyCfsList'),status=document.getElementById('cadCfsListStatus');
if(!host||!status)return;
const panel=host.closest('[data-config-panel]');let sequence=0,lastSignature='';
function render(types){
 host.replaceChildren();
 for(const [discipline,title,icon] of [['LAW','Law Enforcement','🚓'],['FIRE','Fire','🚒'],['EMS','EMS','🚑']]){
  const entries=types.filter(item=>item.discipline===discipline);if(!entries.length)continue;
  const section=document.createElement('section'),heading=document.createElement('h4'),grid=document.createElement('div');
  heading.textContent=title+' · '+entries.length;grid.className='cad-cfs-type-grid';section.append(heading,grid);
  for(const item of entries){
   const card=document.createElement('a');card.className='cad-cfs-type-card '+discipline.toLowerCase();card.href='prototypes/cfs-type-designer.html?type='+encodeURIComponent(item.id);card.target='_blank';card.rel='opener';
   const name=document.createElement('strong');name.textContent=icon+' '+item.name;
   const state=document.createElement('span');state.className='cad-cfs-type-state';state.textContent=item.code+' · '+({ACTIVE:'Active',DRAFT:'Draft · Review needed',INACTIVE:'Inactive'}[item.publication]||item.publication);
   const linked=document.createElement('small');const targets=(item.autoCreate||[]).map(id=>types.find(t=>t.id===id)).filter(Boolean);
   linked.textContent=targets.length?'Linked response: '+targets.map(t=>t.discipline+' · '+t.name).join(' / '):'No automatic linked responses';
   card.append(name,state,linked);grid.append(card);
  }
  host.append(section);
 }
}
async function load(){
 const request=++sequence,session=window.CadDemoLogin?.current();host.replaceChildren();
 if(!session){status.textContent='Sign in to shared CAD to view and edit agency call types.';return}
 status.textContent='Loading agency call types…';
 try{
  const types=await window.CadDemoLogin.client().loadCfsCatalog(session.agencyId);
  if(request!==sequence||window.CadDemoLogin?.current()?.agencyId!==session.agencyId)return;
  render(types);status.textContent=types.length?types.length+' saved call types. Select a card to edit. Draft types need review before activation.':'No agency call types saved yet. Open the visual designer to create one.';
 }catch(error){if(request===sequence)status.textContent='Unable to load agency call types. Use Refresh Call Types to retry.'}
}
document.getElementById('cadCfsRefresh').onclick=load;
document.getElementById('cadConfigSection')?.addEventListener('change',event=>{document.getElementById('saveConfig').hidden=event.target.value==='cfs';if(event.target.value==='cfs')load()});
window.addEventListener('cad:unit-status-catalog-updated',()=>{
 const signature=JSON.stringify(window.cadSharedLastSnapshot?.cfsTypes);
 if(signature!==lastSignature){lastSignature=signature;if(!panel.hidden)load()}
});
document.getElementById('saveConfig').hidden=document.getElementById('cadConfigSection')?.value==='cfs';
load();
})();
