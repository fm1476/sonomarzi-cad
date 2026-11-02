/* Visual shared-apparatus crew editor. Shared DB writes deliberately disabled until atomic RPC is deployed. */
(()=>{'use strict';
const root=document.getElementById('cadResponseWorkspace');
if(!root||!window.CadSharedCrewConfig||!window.CadDemoLogin)return;
const button=document.createElement('button');button.type='button';button.textContent='Shared Crews';button.setAttribute('aria-expanded','false');
const panel=document.createElement('section');panel.hidden=true;panel.className='cad-rp-editor';panel.style.marginTop='12px';
root.before(button);root.after(panel);
button.onclick=()=>{const opening=panel.hidden;panel.hidden=!opening;root.hidden=opening;button.setAttribute('aria-expanded',String(opening));if(opening)load()};
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let groups=[],units=[],agency='',original=[];
async function load(){
 const session=window.CadDemoLogin.current();
 if(!session){panel.textContent='Sign in to shared CAD first.';return}
 agency=session.agencyId;panel.textContent='Loading shared apparatus crews...';
 try{
  const client=window.CadDemoLogin.client();
  const [crewRows,links,roster]=await Promise.all([client.listSharedCrews(agency),client.listSharedCrewUnits(agency),client.listUnits(agency)]);
  if(window.CadDemoLogin.current()?.agencyId!==agency)return;
  units=roster;
  groups=crewRows.map(g=>({id:g.id,name:g.name,agencyId:agency,unitIds:links.filter(l=>l.crew_id===g.id).map(l=>l.unit_id)}));
  original=structuredClone(groups);
  draw();
 }catch(e){panel.textContent='Unable to load shared crews: '+e.message}
}
function draw(){
 panel.replaceChildren();
 const heading=document.createElement('h4');heading.textContent='Shared Apparatus Crews';panel.append(heading);
 const close=document.createElement('button');close.type='button';close.textContent='Back to Response Plans';close.onclick=()=>{panel.hidden=true;root.hidden=false;button.setAttribute('aria-expanded','false')};panel.append(close);
 const note=document.createElement('p');note.textContent='Select any number of apparatus per group, even across stations. Changes are staged only. Saving requires a verified atomic database operation that is not yet deployed.';panel.append(note);
 const add=document.createElement('button');add.type='button';add.textContent='+ New Crew Group';add.onclick=()=>{groups.push({id:'draft-'+crypto.randomUUID(),name:'New Shared Crew',agencyId:agency,unitIds:[]});draw()};panel.append(add);
 for(let i=0;i<groups.length;i++){
  const group=groups[i],card=document.createElement('section');card.className='cad-rp-requirement';card.style.display='block';
  const title=document.createElement('input');title.setAttribute('aria-label','Crew group name');title.value=group.name;title.oninput=()=>{group.name=title.value;validate()};card.append(title);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove group from draft';remove.onclick=()=>{groups.splice(i,1);draw()};card.append(remove);
  const members=document.createElement('div');members.style.marginTop='10px';
  for(const u of units){
   const key=u.id,chosen=group.unitIds.includes(key),b=document.createElement('button');b.type='button';
   b.textContent=(chosen?'✓ ':'+ ')+(u.call_sign||key)+' · '+(u.resource_type||'Unit');b.setAttribute('aria-pressed',String(chosen));b.style.margin='4px';b.style.borderRadius='10px';
   b.onclick=()=>{group.unitIds=chosen?group.unitIds.filter(x=>x!==key):[...group.unitIds,key];draw()};members.append(b);
  }card.append(members);panel.append(card);
 }
 const warning=document.createElement('p');warning.id='cadSharedCrewErrors';warning.setAttribute('role','status');panel.append(warning);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Discard draft changes';reset.onclick=()=>{groups=structuredClone(original);draw()};panel.append(reset);
 const status=document.createElement('p');status.textContent='Read-only shared CAD. Draft changes are not saved or enforced.';panel.append(status);
 validate();
}
function validate(){const target=panel.querySelector('#cadSharedCrewErrors');if(target){const errors=window.CadSharedCrewConfig.validate(groups,units);target.textContent=errors.length?errors.join(' | '):'Crew configuration has no membership conflicts.'}}
})();
