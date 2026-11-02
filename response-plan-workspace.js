/* Unified response-plan workspace preview. Existing local designer remains available as migration source. */
(()=>{'use strict';
const host=document.getElementById('cadResponseDesigner');
if(!host||!window.CadResponseEngine)return;
const KEY='smcad-response-plans-v1';
const old=host;
const shell=document.createElement('section');shell.id='cadResponseWorkspace';shell.className='cad-rp-workspace';
old.before(shell);
old.hidden=true;
let plans=[],types=[],selected=null,version=null,sessionId=null,working=null,activeAgencyName='';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=s=>{try{const p=JSON.parse(s||'[]');return Array.isArray(p)?p:[]}catch{return []}};
const status=msg=>{const e=document.getElementById('rpWorkspaceMessage');if(e)e.textContent=msg};
const normalize=p=>({...p,status:p.status==='Published'?'ACTIVE':p.status==='Draft'?'DRAFT':String(p.status||'DRAFT').toUpperCase(),area:p.area||p.zone||'',agencyId:p.agencyId||null,cfsTypeId:p.cfsTypeId||null,resources:(p.resources||[]).map(r=>({...r,preferredUnits:r.preferredUnits||((p.runOrders||{})[r.type]||[]).filter(x=>x.kind==='UNIT').map(x=>x.value)}))});
const session=()=>window.CadDemoLogin?.current();
async function reload(){
 const s=session();
 if(!s){sessionId=null;plans=[];types=[];version=null;draw();status('Connect to shared CAD to manage authoritative response plans. Your existing local plans have not been changed.');return}
 sessionId=s.agencyId;status('Loading shared CFS types and response plans...');
 try{
 const client=window.CadDemoLogin.client();
 const [catalog,documents]=await Promise.all([client.loadCfsCatalog(s.agencyId),client.listAgencySettings(s.agencyId)]);
 if(session()?.agencyId!==sessionId)return;
 types=catalog;
 activeAgencyName=window.CadCloudSettings?.sharedMaster?.()?.agencies?.find(a=>a.id===s.agencyId)?.name||'';
 const doc=documents.find(x=>x.document_key===KEY);
 version=doc?.version??null;
 plans=parse(doc?.payload?.raw).map(normalize);
 if(!selected||!plans.some(p=>p.id===selected))selected=plans[0]?.id||null;
 draw();status(doc?'Shared response plans loaded.':'No shared response plans saved. Review existing local plans for import.');
 }catch(e){draw();status('Unable to load shared configuration: '+e.message)}
}
function cfs(p){return types.find(t=>t.id===p?.cfsTypeId)||types.find(t=>t.discipline===p?.discipline&&t.name?.toLowerCase()===p?.type?.toLowerCase())}
function draw(){
 const p=plans.find(x=>x.id===selected)||null;
 shell.innerHTML='<header class="cad-rp-heading"><div><h3>Response Plans</h3><p>Review plan requirements, activation and dispatch recommendations by call type.</p></div><div class="cad-rp-header-actions"><button type="button" id="rpRefreshNew">Refresh</button><button type="button" id="rpImportNew">Review Existing Plans</button><button type="button" id="rpCreateNew">+ New Response Plan</button></div></header><div class="cad-rp-columns"><aside class="cad-rp-list"><strong>Agency response plans</strong><input id="rpSearchNew" placeholder="Search plans..." aria-label="Search response plans"><div id="rpPlanCards"></div></aside><section class="cad-rp-editor" id="rpPlanEditor"></section><aside class="cad-rp-preview" id="rpPlanPreview"></aside></div><p id="rpWorkspaceMessage" role="status"></p>';
 document.getElementById('rpRefreshNew').onclick=reload;
 document.getElementById('rpImportNew').onclick=importLocal;
 document.getElementById('rpCreateNew').onclick=()=>{if(!session())return status('Connect to shared CAD first.');selected=null;working={id:crypto.randomUUID(),status:'DRAFT',discipline:'FIRE',priority:null,cfsTypeId:null,area:'',resources:[]};editor(working)};
 document.getElementById('rpSearchNew').oninput=renderCards;
 renderCards();editor(p);
}
function renderCards(){
 const filter=(document.getElementById('rpSearchNew')?.value||'').toLowerCase();
 const cards=document.getElementById('rpPlanCards');
 cards.innerHTML=plans.filter(p=>(p.type+' '+p.discipline+' '+p.area).toLowerCase().includes(filter)).map(p=>'<button type="button" class="cad-rp-plan-card '+(p.id===selected?'selected':'')+'" data-plan="'+escape(p.id)+'"><strong>'+escape(p.discipline==='FIRE'?'🚒':p.discipline==='EMS'?'🚑':'🚓')+' '+escape(cfs(p)?.name||p.type||'Unlinked call type')+'</strong><small>'+escape(p.discipline)+' · '+escape(p.area||'All areas')+' · '+escape(p.status)+'</small></button>').join('')||'<p>No response plans found.</p>';
 cards.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{selected=b.dataset.plan;draw()});
}
function editor(p){
 const e=document.getElementById('rpPlanEditor'),v=document.getElementById('rpPlanPreview');if(!e||!v)return;
 if(!p){e.innerHTML='<h4>Select or create a response plan</h4><p>Existing plans are shown on the left.</p>';v.innerHTML='<h4>Plan Preview</h4><p>Select a plan to review its response requirements.</p>';return}
 working=structuredClone(p);
 const options=types.filter(t=>t.discipline===p.discipline);
 e.innerHTML='<h4>'+escape(p.type||'New Response Plan')+'</h4><div class="cad-rp-fields"><label>Discipline<select id="rpNewDiscipline"><option>LAW</option><option>FIRE</option><option>EMS</option></select></label><label>Call type<select id="rpNewCfs"></select></label><label>Priority<input id="rpNewPriority" type="number" min="1" max="9" placeholder="Any priority"></label><label>Response area<input id="rpNewArea" placeholder="All configured areas"></label></div><h4>Response Requirements</h4><p>Use configured resource types. Reorder requirements using the arrow controls.</p><div id="rpNewRequirements"></div><button type="button" id="rpNewAdd">+ Add Requirement</button><div class="cad-rp-actions"><button id="rpNewSave" type="button">Save Draft</button><button id="rpNewActivate" type="button">Activate Plan</button><button id="rpNewDeactivate" type="button">Deactivate</button></div>';
 const discipline=document.getElementById('rpNewDiscipline'),type=document.getElementById('rpNewCfs');
 discipline.value=p.discipline;
 const typesFor=()=>{type.innerHTML=types.filter(t=>t.discipline===discipline.value).map(t=>'<option value="'+escape(t.id)+'">'+escape(t.name)+' ('+escape(t.publication)+')</option>').join('');if(working.cfsTypeId)type.value=working.cfsTypeId;};
 discipline.onchange=()=>{working.discipline=discipline.value;working.cfsTypeId=null;typesFor();drawRequirements()};typesFor();
 document.getElementById('rpNewPriority').value=p.priority??'';
 document.getElementById('rpNewArea').value=p.area||p.zone||'';
 function drawRequirements(){
 const target=document.getElementById('rpNewRequirements');
 target.innerHTML=working.resources.map((r,i)=>'<div class="cad-rp-requirement"><strong>'+escape(r.type)+'</strong><label>Quantity <input data-count="'+i+'" type="number" min="1" max="99" value="'+Number(r.count||1)+'"></label><label>Preferred unit order <input data-preferred="'+i+'" value="'+escape((r.preferredUnits||[]).join(', '))+'" placeholder="E1, E2, E3"></label><button data-up="'+i+'" type="button" aria-label="Move up">↑</button><button data-down="'+i+'" type="button" aria-label="Move down">↓</button><button data-remove="'+i+'" type="button" aria-label="Remove requirement">Remove</button></div>').join('')||'<p>No resource requirements. Add at least one before activating.</p>';
 target.querySelectorAll('[data-count]').forEach(n=>n.onchange=()=>{working.resources[Number(n.dataset.count)].count=Number(n.value);preview()});
 target.querySelectorAll('[data-preferred]').forEach(n=>n.onchange=()=>{working.resources[Number(n.dataset.preferred)].preferredUnits=n.value.split(',').map(x=>x.trim()).filter(Boolean);preview()});
 target.querySelectorAll('[data-remove]').forEach(n=>n.onclick=()=>{working.resources.splice(Number(n.dataset.remove),1);drawRequirements()});
 for(const [attr,shift] of [['up',-1],['down',1]])target.querySelectorAll('[data-'+attr+']').forEach(n=>n.onclick=()=>{const i=Number(n.dataset[attr]),j=i+shift;if(j<0||j>=working.resources.length)return;[working.resources[i],working.resources[j]]=[working.resources[j],working.resources[i]];drawRequirements()});
 preview();
 }
 const add=document.getElementById('rpNewAdd');
 const picker=document.createElement('select');picker.id='rpResourcePicker';picker.setAttribute('aria-label','Choose configured resource type');
 add.before(picker);
 function resourceOptions(){
  const agency=activeAgencyName||window.CadAgencyMaster?.read(localStorage)?.agencies?.[0]?.name||'';
  const available=window.CadResourceTypes?.forAgency(agency,discipline.value)||[];
  picker.replaceChildren();
  for(const entry of available){const option=document.createElement('option');option.value=entry.name;option.textContent=entry.name;picker.append(option)}
  if(!available.length){const option=document.createElement('option');option.value='';option.textContent='No configured resource types';picker.append(option);add.disabled=true}
  else add.disabled=false;
 }
 const oldChange=discipline.onchange;
 discipline.onchange=()=>{oldChange();resourceOptions()};
 resourceOptions();
 add.onclick=()=>{const resource=picker.value;if(!resource)return status('Configure resource types under Agencies & Units first.');working.resources.push({type:resource,count:1,preferredUnits:[]});drawRequirements()};
 const snapshot=()=>{const chosen=types.find(t=>t.id===type.value);return {...working,discipline:discipline.value,cfsTypeId:chosen?.id||null,type:chosen?.name||'',priority:document.getElementById('rpNewPriority').value===''?null:Number(document.getElementById('rpNewPriority').value),area:document.getElementById('rpNewArea').value.trim()}};
 for(const [id,state] of [['rpNewSave','DRAFT'],['rpNewActivate','ACTIVE'],['rpNewDeactivate','INACTIVE']])document.getElementById(id).onclick=()=>savePlan({...snapshot(),status:state});
 function preview(){v.innerHTML='<h4>Plan Preview</h4><p>Requirements are reviewed here. Actual unit recommendations need a current shared incident and roster.</p>'+working.resources.map(r=>'<div class="cad-rp-preview-line"><strong>'+escape(r.count)+' × '+escape(r.type)+'</strong><small>'+escape((r.preferredUnits||[]).join(' → ')||'No preferred unit order configured')+'</small></div>').join('')+'<p>No units dispatched. Availability and staffing must be verified against the shared CAD before assignment.</p>'}
 drawRequirements();
}
async function savePlan(p){
 if(!session())return status('Connect to shared CAD before saving.');
 if(!p.cfsTypeId)return status('Select a saved discipline-specific call type.');
 if(!p.resources?.length)return status('Add at least one response requirement.');
 const selectedType=types.find(t=>t.id===p.cfsTypeId);
 if(p.status==='ACTIVE'&&selectedType?.publication!=='ACTIVE')return status('The selected CFS type must be Active before this plan can be activated.');
 if(p.resources.some(r=>!r.type||!Number.isInteger(Number(r.count))||Number(r.count)<1||Number(r.count)>99))return status('Each requirement needs a resource type and a quantity between 1 and 99.');
 if(p.status==='ACTIVE'&&p.resources.some(r=>!(r.preferredUnits||[]).length&&!r.specificUnit&&!r.allowUnrankedFallback))return status('Configure the response order for every requirement before activation. No automatic nearest-unit selection is available.');
 const next=[...plans.filter(x=>x.id!==p.id),p];
 try{
 const result=await window.CadDemoLogin.client().saveCloudSetting({agency:session().agencyId,scope:'AGENCY',key:KEY,payload:{raw:JSON.stringify(next)},expectedVersion:version});
 status('Saved. Reloading plans to confirm the shared version.');
 selected=p.id;await reload();
 }catch(e){status('Save blocked: '+e.message+'. Refresh before retrying. No local plans were deleted.')}
}
async function importLocal(){
 if(!session())return status('Connect to shared CAD before importing.');
 const local=parse(localStorage.getItem(KEY)).map(normalize);
 if(!local.length)return status('No existing local plans were found in this browser.');
 const existing=new Set(plans.map(x=>x.id));
 const additions=local.filter(x=>!existing.has(x.id)).map(x=>({...x,status:'DRAFT',cfsTypeId:cfs(x)?.id||null}));
 if(!additions.length)return status('All local plan identifiers are already present in shared configuration.');
 if(!confirm('Import '+additions.length+' local plans as drafts for review? Existing shared plans will remain unchanged.'))return;
 try{await window.CadDemoLogin.client().saveCloudSetting({agency:session().agencyId,scope:'AGENCY',key:KEY,payload:{raw:JSON.stringify([...plans,...additions])},expectedVersion:version});await reload();status('Imported '+additions.length+' plans as drafts. Review call-type links and requirements before activation.');}
 catch(e){status('Import blocked: '+e.message)}
}
document.getElementById('cadConfigSection')?.addEventListener('change',e=>{if(e.target.value==='response')reload()});
window.addEventListener('cad-cloud-settings-applied',e=>{if(e.detail?.keys?.includes(KEY))reload()});
draw();
})();