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
 e.innerHTML='<h4>'+escape(p.type||'New Response Plan')+'</h4><div class="cad-rp-fields"><label>Discipline<select id="rpNewDiscipline"><option>LAW</option><option>FIRE</option><option>EMS</option></select></label><label>Call type<select id="rpNewCfs"></select></label><label>Priority<input id="rpNewPriority" type="number" min="1" max="9" placeholder="Any priority"></label><label>Response area<input id="rpNewArea" placeholder="All configured areas"></label></div><h4>Response Requirements</h4><p>Use configured resource types. Reorder requirements using the arrow controls.</p><div id="rpNewRequirements"></div><button type="button" id="rpNewAdd">+ Add Requirement</button><h4>Alarm Levels</h4><p>Each level defines a total target or additional resources. Escalation never dispatches automatically.</p><div id="rpNewAlarms"></div><button type="button" id="rpNewAlarmAdd">+ Add Alarm Level</button><div class="cad-rp-actions"><button id="rpNewSave" type="button">Save Draft</button><button id="rpNewActivate" type="button">Activate Plan</button><button id="rpNewDeactivate" type="button">Deactivate</button></div>';
 const discipline=document.getElementById('rpNewDiscipline'),type=document.getElementById('rpNewCfs');
 discipline.value=p.discipline;
 const typesFor=()=>{type.innerHTML=types.filter(t=>t.discipline===discipline.value).map(t=>'<option value="'+escape(t.id)+'">'+escape(t.name)+' ('+escape(t.publication)+')</option>').join('');if(working.cfsTypeId)type.value=working.cfsTypeId;};
 discipline.onchange=()=>{working.discipline=discipline.value;working.cfsTypeId=null;typesFor();drawRequirements()};typesFor();
 document.getElementById('rpNewPriority').value=p.priority??'';
 document.getElementById('rpNewArea').value=p.area||p.zone||'';
 function drawRequirements(){
 const target=document.getElementById('rpNewRequirements');
 target.innerHTML=working.resources.map((r,i)=>'<div class="cad-rp-requirement"><strong>'+escape(r.type)+'</strong><label>Quantity <input data-count="'+i+'" type="number" min="1" max="99" value="'+Number(r.count||1)+'"></label><label>Minimum crew <input data-staffing="'+i+'" type="number" min="1" max="30" placeholder="Not required" value="'+(r.requiredStaffing??'')+'"></label><label>Preferred unit order <input data-preferred="'+i+'" value="'+escape((r.preferredUnits||[]).join(', '))+'" placeholder="Choose units below"></label><div data-unit-picker="'+i+'"></div><button data-up="'+i+'" type="button" aria-label="Move up">↑</button><button data-down="'+i+'" type="button" aria-label="Move down">↓</button><button data-remove="'+i+'" type="button" aria-label="Remove requirement">Remove</button></div>').join('')||'<p>No resource requirements. Add at least one before activating.</p>';
 const master=window.CadAgencyMaster?.read(localStorage)||{agencies:[],units:[]};
 const agency=master.agencies.find(a=>a.name===activeAgencyName)||master.agencies[0];
 target.querySelectorAll('[data-unit-picker]').forEach(node=>{
  const i=Number(node.dataset.unitPicker),r=working.resources[i];
  const units=master.units.filter(u=>u.discipline===discipline.value&&u.resourceType===r.type&&(!agency||u.agencyId===agency.id)).sort((a,b)=>String(a.stationName||a.stationId||a.homeStationId||'Unassigned').localeCompare(String(b.stationName||b.stationId||b.homeStationId||'Unassigned'))||String(a.designator||'').localeCompare(String(b.designator||'')));
  if(!units.length){node.textContent='No configured units of this type.';return}
  const hint=document.createElement('small');hint.textContent='Select units in dispatch order. Select again to remove.';node.append(hint);
  let lastStation='';
  for(const u of units){
   const station=String(u.stationName||u.stationId||u.homeStationId||'Station not assigned');
   if(station!==lastStation){const heading=document.createElement('strong');heading.textContent=station;heading.style.display='block';node.append(heading);lastStation=station}
   const sign=u.designator||u.callSign||u.name||u.id;
   const index=(r.preferredUnits||[]).findIndex(x=>String(x).toUpperCase()===String(sign).toUpperCase());
   const b=document.createElement('button');b.type='button';b.textContent=(index<0?'+ ':(index+1)+'. ')+sign;b.style.margin='4px';b.style.borderRadius='10px';b.setAttribute('aria-pressed',String(index>=0));
   b.onclick=()=>{const next=(r.preferredUnits||[]).filter(x=>String(x).toUpperCase()!==String(sign).toUpperCase());if(index<0)next.push(sign);r.preferredUnits=next;drawRequirements()};node.append(b);
  }
 });
 target.querySelectorAll('[data-count]').forEach(n=>n.onchange=()=>{working.resources[Number(n.dataset.count)].count=Number(n.value);preview()});
 target.querySelectorAll('[data-staffing]').forEach(n=>n.onchange=()=>{const raw=n.value.trim();working.resources[Number(n.dataset.staffing)].requiredStaffing=raw===''?null:Number(raw);preview()});
 target.querySelectorAll('[data-preferred]').forEach(n=>n.onchange=()=>{working.resources[Number(n.dataset.preferred)].preferredUnits=n.value.split(',').map(x=>x.trim()).filter(Boolean);preview()});
 target.querySelectorAll('[data-remove]').forEach(n=>n.onclick=()=>{working.resources.splice(Number(n.dataset.remove),1);drawRequirements()});
 for(const [attr,shift] of [['up',-1],['down',1]])target.querySelectorAll('[data-'+attr+']').forEach(n=>n.onclick=()=>{const i=Number(n.dataset[attr]),j=i+shift;if(j<0||j>=working.resources.length)return;[working.resources[i],working.resources[j]]=[working.resources[j],working.resources[i]];drawRequirements()});
 preview();
 }
 function drawAlarms(){
  const holder=document.getElementById('rpNewAlarms');
  const levels=working.alarmLevels||[];
  holder.innerHTML=levels.map((level,i)=>'<div class="cad-rp-requirement"><label>Level name <input data-alarm-name="'+i+'" value="'+escape(level.name||'')+'"></label><label>Sequence <input type="number" min="1" data-alarm-rank="'+i+'" value="'+Number(level.rank||i+1)+'"></label><label>Calculation <select data-alarm-mode="'+i+'"><option value="TOTAL">Total resources needed</option><option value="ADDITIVE">Add these resources</option></select></label><button type="button" data-alarm-remove="'+i+'">Remove level</button><div style="width:100%"><strong>Level resources</strong><div data-alarm-rows="'+i+'"></div><button type="button" data-alarm-add="'+i+'">+ Resource</button></div></div>').join('')||'<p>No additional alarm levels defined.</p>';
  levels.forEach((level,i)=>{
   const name=holder.querySelector('[data-alarm-name="'+i+'"]'),rank=holder.querySelector('[data-alarm-rank="'+i+'"]'),mode=holder.querySelector('[data-alarm-mode="'+i+'"]');
   name.onchange=()=>{level.name=name.value.trim();preview()};rank.onchange=()=>{level.rank=Number(rank.value);preview()};mode.value=level.mode||'TOTAL';mode.onchange=()=>{level.mode=mode.value;preview()};
   holder.querySelector('[data-alarm-remove="'+i+'"]').onclick=()=>{levels.splice(i,1);drawAlarms();preview()};
   const rows=holder.querySelector('[data-alarm-rows="'+i+'"]');
   function redrawRows(){
    rows.innerHTML=(level.resources||[]).map((r,j)=>'<div class="cad-rp-requirement"><label>Resource <input data-level-type="'+j+'" value="'+escape(r.type||'')+'"></label><label>Quantity <input type="number" min="1" max="99" data-level-count="'+j+'" value="'+Number(r.count||1)+'"></label><label>Preferred units <input data-level-units="'+j+'" value="'+escape((r.preferredUnits||[]).join(', '))+'"></label><button data-level-remove="'+j+'" type="button">Remove</button></div>').join('');
    (level.resources||[]).forEach((r,j)=>{
     rows.querySelector('[data-level-type="'+j+'"]').onchange=e=>{r.type=e.target.value.trim().toUpperCase();preview()};
     rows.querySelector('[data-level-count="'+j+'"]').onchange=e=>{r.count=Number(e.target.value);preview()};
     rows.querySelector('[data-level-units="'+j+'"]').onchange=e=>{r.preferredUnits=e.target.value.split(',').map(v=>v.trim()).filter(Boolean);preview()};
     rows.querySelector('[data-level-remove="'+j+'"]').onclick=()=>{level.resources.splice(j,1);redrawRows();preview()};
    });
   }
   holder.querySelector('[data-alarm-add="'+i+'"]').onclick=()=>{level.resources??=[];level.resources.push({type:document.getElementById('rpResourcePicker')?.value||'',count:1,preferredUnits:[]});redrawRows();preview()};
   redrawRows();
  });
 }
 document.getElementById('rpNewAlarmAdd').onclick=()=>{working.alarmLevels??=[];working.alarmLevels.push({id:crypto.randomUUID(),name:'New Alarm Level',rank:working.alarmLevels.length+1,mode:'TOTAL',resources:[]});drawAlarms();preview()};
 drawAlarms();
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
 for(const input of [type,document.getElementById('rpNewPriority'),document.getElementById('rpNewArea')])input.onchange=()=>preview();
 for(const [id,state] of [['rpNewSave','DRAFT'],['rpNewActivate','ACTIVE'],['rpNewDeactivate','INACTIVE']])document.getElementById(id).onclick=()=>savePlan({...snapshot(),status:state});
 let simulatedCommitted=[];
 let simulatedOnIncident=[];
 let simulatedCrew=false;
 let simulatedCrewMembers=[];
 let simulatedAlarm='';
 function preview(){
  v.innerHTML='<h4>Plan Preview</h4><p>These requirements are not yet dispatched.</p>'+working.resources.map(r=>'<div class="cad-rp-preview-line"><strong>'+escape(r.count)+' × '+escape(r.type)+'</strong><small>'+escape((r.preferredUnits||[]).join(' → ')||'No preferred unit order configured')+'</small></div>').join('')+'<h4>Escalation</h4>'+((working.alarmLevels||[]).map(l=>'<p>'+escape(l.name)+' · '+escape(l.mode||'TOTAL')+' · '+(l.resources||[]).map(r=>escape(r.count+' × '+r.type)).join(', ')+'</p>').join('')||'<p>No alarm escalation configured.</p>')+'<p>'+((working.resources||[]).some(r=>r.requiredStaffing!=null)?'Minimum crew rules require verified staffing. Fictional staffing is used for simulation only.':'No minimum crew requirement configured.')+'</p><hr><h4>Test Response · Fictional Simulation</h4><p>Safe preview only. No shared incidents or unit assignments are changed.</p><div id="rpSimControls"></div><div id="rpSimResults" role="status"></div>';
  const controls=v.querySelector('#rpSimControls'),output=v.querySelector('#rpSimResults');
  const resourceUnits=new Map();
  for(const req of [...working.resources,...(working.alarmLevels||[]).flatMap(l=>l.resources||[])])for(const callSign of req.preferredUnits||[])if(!resourceUnits.has(callSign))resourceUnits.set(callSign,req.type);
  const names=[...resourceUnits.keys()];
  if(!names.length){output.textContent='Choose preferred apparatus in the requirements to test the response.';return}
  simulatedCommitted=simulatedCommitted.filter(x=>resourceUnits.has(x));
  simulatedOnIncident=simulatedOnIncident.filter(x=>resourceUnits.has(x));
  simulatedCrewMembers=simulatedCrewMembers.filter(x=>resourceUnits.has(x));
  const select=document.createElement('select');select.setAttribute('aria-label','Fictional unit assigned to another call');
  for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option)}
  const busy=document.createElement('button');busy.type='button';busy.textContent='Simulate Unit Committed';busy.onclick=()=>{simulatedOnIncident=simulatedOnIncident.filter(x=>x!==select.value);if(!simulatedCommitted.includes(select.value))simulatedCommitted.push(select.value);preview()};
  const onCall=document.createElement('button');onCall.type='button';onCall.textContent='Assign to Fictional Incident';onCall.onclick=()=>{simulatedCommitted=simulatedCommitted.filter(x=>x!==select.value);if(!simulatedOnIncident.includes(select.value))simulatedOnIncident.push(select.value);preview()};
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset Simulation';reset.onclick=()=>{simulatedCommitted=[];simulatedOnIncident=[];simulatedCrew=false;simulatedCrewMembers=[];simulatedAlarm='';preview()};
  const shared=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent='Fictional shared crew (choose any two or more apparatus)';shared.append(legend);
  for(const name of names){const label=document.createElement('label');label.style.display='inline-flex';label.style.margin='4px';const check=document.createElement('input');check.type='checkbox';check.checked=simulatedCrewMembers.includes(name);check.onchange=()=>{simulatedCrewMembers=check.checked?[...simulatedCrewMembers,name]:simulatedCrewMembers.filter(x=>x!==name);simulatedCrew=simulatedCrewMembers.length>=2;preview()};label.append(check,document.createTextNode(' '+name));shared.append(label)}
  controls.append(select,busy,onCall,reset,shared);
  const levels=[...(working.alarmLevels||[])].sort((a,b)=>Number(a.rank)-Number(b.rank));
  const alarmSelect=document.createElement('select');alarmSelect.setAttribute('aria-label','Simulation alarm level');
  alarmSelect.append(new Option('Initial response',''));
  for(const l of levels)alarmSelect.append(new Option(l.name||'Unnamed level',l.id));
  alarmSelect.value=simulatedAlarm;alarmSelect.onchange=()=>{simulatedAlarm=alarmSelect.value;preview()};
  controls.append(alarmSelect);
  const incident={id:'fictional-incident',agency_id:'fictional-agency',discipline:discipline.value,type:snapshot().type,priority:snapshot().priority,response_zone:snapshot().area||'DEFAULT'};
  const roster=names.map((name,i)=>({id:'fictional-'+i,call_sign:name,agency_id:'fictional-agency',discipline:discipline.value,resource_type:resourceUnits.get(name),status:'AVAILABLE',staffing:{active:true,personIds:Array.from({length:30},(_,j)=>'fictional-person-'+i+'-'+j)}}));
  const assignments=[...simulatedCommitted.map(name=>({incident_id:'fictional-other-call',unit_id:roster.find(u=>u.call_sign===name)?.id})),...simulatedOnIncident.map(name=>({incident_id:incident.id,unit_id:roster.find(u=>u.call_sign===name)?.id}))].filter(x=>x.unit_id);
  const crews=simulatedCrew?[{id:'fictional-crew',units:simulatedCrewMembers}]:[];
  const simulatedPlan={...snapshot(),status:'ACTIVE',agencyId:'fictional-agency',resources:working.resources};
  const currentLevel=levels.find(l=>l.id===simulatedAlarm);
  const result=currentLevel?window.CadResponseEngine.escalate({plan:simulatedPlan,incident,roster,assignments,crews,stations:[],level:currentLevel.id}):window.CadResponseEngine.recommend({plan:simulatedPlan,incident,roster,assignments,crews,stations:[]});
  const heading=document.createElement('strong');heading.textContent='Simulation: '+result.status.toUpperCase();output.append(heading);
  const message=document.createElement('p');message.textContent=result.message;output.append(message);
  const totals=document.createElement('p');totals.textContent='Already on incident: '+simulatedOnIncident.length+' · Additional recommended: '+(result.unitIds||[]).length+' · Unfilled requirements: '+(result.missing||[]).reduce((sum,r)=>sum+r.count,0);output.append(totals);
  const recommended=new Set(result.unitIds||[]);
  const exclusions=new Map(result.rows.flatMap(row=>row.excluded.map(entry=>[entry.unit,entry.reason])));
  const cards=document.createElement('div');cards.className='cad-rp-simulation-cards';cards.style.display='grid';cards.style.gridTemplateColumns='repeat(auto-fit,minmax(130px,1fr))';cards.style.gap='8px';cards.style.margin='12px 0';
  const selectedCrew=simulatedCrew?new Set(simulatedCrewMembers) : new Set();
  for(const name of names){
   const card=document.createElement('div');card.className='cad-rp-simulation-card';card.style.padding='10px';card.style.border='1px solid var(--border-color,#778)';card.style.borderRadius='12px';
   const title=document.createElement('strong');title.textContent=name;card.append(title);
   const type=document.createElement('small');type.style.display='block';type.textContent=resourceUnits.get(name);card.append(type);
   const committed=simulatedCommitted.includes(name),onIncident=simulatedOnIncident.includes(name);
   const partner=[...simulatedCommitted,...simulatedOnIncident].find(other=>other!==name&&selectedCrew.has(other)&&selectedCrew.has(name));
   const state=document.createElement('p');
   state.textContent=onIncident?'✓ Already on incident':committed?'● Assigned elsewhere':partner?'● Crew committed by '+partner:recommended.has(roster.find(u=>u.call_sign===name)?.id)?'✓ Recommended':'○ Not selected';
   state.style.fontWeight='600';card.append(state);
   const reason=document.createElement('small');reason.textContent=partner?'Shared apparatus uses the same crew':exclusions.get(name)||'';card.append(reason);
   cards.append(card);
  }
  output.append(cards);
  const conflicts=[...cards.querySelectorAll('.cad-rp-simulation-card')].filter(card=>card.textContent.includes('Crew committed'));
  if(conflicts.length&&window.CadSharedCrewConfig?.overrideReview){
   const review=document.createElement('section');review.className='cad-rp-requirement';
   const title=document.createElement('strong');title.textContent='Shared Crew Override Rehearsal';review.append(title);
   const info=document.createElement('p');info.textContent='Fictional training only. No live override authority or assignment is created.';review.append(info);
   const target=document.createElement('select');target.setAttribute('aria-label','Apparatus to rehearse override');
   const blocked=simulatedCrew?simulatedCrewMembers.filter(name=>!simulatedCommitted.includes(name)&&!simulatedOnIncident.includes(name)):[];
   for(const name of blocked){const option=document.createElement('option');option.value=name;option.textContent=name;target.append(option)}
   const reason=document.createElement('textarea');reason.placeholder='Why is the additional apparatus independently available?';reason.setAttribute('aria-label','Fictional override reason');
   const authorized=document.createElement('label');const box=document.createElement('input');box.type='checkbox';authorized.append(box,document.createTextNode(' Simulate authorized dispatcher role'));
   const check=document.createElement('button');check.type='button';check.textContent='Review Fictional Override';
   const feedback=document.createElement('p');feedback.setAttribute('role','status');
   check.onclick=()=>{
    const group=[{id:'fictional-crew',name:'Fictional Shared Crew',unitIds:simulatedCrewMembers}];
    const assessment=window.CadSharedCrewConfig.overrideReview({unitId:target.value,groups:group,committedUnitIds:[...simulatedCommitted,...simulatedOnIncident],reason:reason.value,authorized:box.checked});
    feedback.textContent=assessment.message+(assessment.allowed?' A real dispatcher must still pass server checks and confirm the audit record.':'');
   };
   review.append(target,reason,authorized,check,feedback);output.append(review);
  }
  for(const row of result.rows){
   const line=document.createElement('div');line.className='cad-rp-preview-line';
   const title=document.createElement('strong');title.textContent=row.type+' · '+row.recommended.length+' recommended / '+row.requested+' requested';line.append(title);
   for(const unit of row.recommended){const p=document.createElement('p');p.textContent='✓ '+unit.callSign+' · '+unit.reason;line.append(p)}
   for(const excluded of row.excluded){const p=document.createElement('small');p.style.display='block';p.textContent='Excluded '+excluded.unit+': '+excluded.reason;line.append(p)}
   if(row.shortage){const p=document.createElement('p');p.textContent='Unfilled: '+row.shortage;line.append(p)}
   output.append(line);
  }
 }

 drawRequirements();
}
async function savePlan(p){
 if(!session())return status('Connect to shared CAD before saving.');
 if(!p.cfsTypeId)return status('Select a saved discipline-specific call type.');
 if(p.priority!==null&&p.priority!==undefined&&(!Number.isInteger(p.priority)||p.priority<1||p.priority>9))return status('Priority must be between 1 and 9, or left blank for any priority.');
 const duplicates=plans.filter(x=>x.id!==p.id&&x.status==='ACTIVE'&&p.status==='ACTIVE'&&x.discipline===p.discipline&&x.cfsTypeId===p.cfsTypeId&&String(x.area||'').toUpperCase()===String(p.area||'').toUpperCase()&&x.priority===p.priority);
 if(duplicates.length)return status('An active plan already covers this call type, priority and response area. Deactivate or edit that plan first.');
 if(!p.resources?.length)return status('Add at least one response requirement.');
 if(new Set(p.resources.map(r=>String(r.type||'').trim().toUpperCase())).size!==p.resources.length)return status('Combine duplicate resource types into one requirement before saving.');
 if(p.status==='ACTIVE'&&p.alarmLevels?.length){const ranks=new Set();for(const tier of p.alarmLevels){if(!tier.name||!Number.isInteger(Number(tier.rank))||Number(tier.rank)<1||ranks.has(Number(tier.rank)))return status('Alarm levels require unique positive sequence numbers and names.');ranks.add(Number(tier.rank));if(!['TOTAL','ADDITIVE'].includes(String(tier.mode||'TOTAL').toUpperCase()))return status('Unsupported alarm method.');if(!tier.resources?.length||tier.resources.some(r=>!r.type||!Number.isInteger(Number(r.count))||Number(r.count)<1||Number(r.count)>99))return status('Alarm levels require valid resource quantities.');}}
 const selectedType=types.find(t=>t.id===p.cfsTypeId);
 if(p.status==='ACTIVE'&&selectedType?.publication!=='ACTIVE')return status('The selected CFS type must be Active before this plan can be activated.');
 if(p.resources.some(r=>r.requiredStaffing!=null&&(!Number.isInteger(Number(r.requiredStaffing))||Number(r.requiredStaffing)<1||Number(r.requiredStaffing)>30)))return status('Minimum crew must be 1 to 30, or blank if not required.');
 if(p.resources.some(r=>!r.type||!Number.isInteger(Number(r.count))||Number(r.count)<1||Number(r.count)>99))return status('Each requirement needs a resource type and a quantity between 1 and 99.');
 if(p.status==='ACTIVE'&&p.resources.some(r=>!(r.preferredUnits||[]).length&&!r.specificUnit&&!r.allowUnrankedFallback))return status('Configure the response order for every requirement before activation. No automatic nearest-unit selection is available.');
 const next=[...plans.filter(x=>x.id!==p.id),p];
 try{
 const result=await window.CadDemoLogin.client().saveCloudSetting({agency:session().agencyId,scope:'AGENCY',key:KEY,payload:{raw:JSON.stringify(next)},expectedVersion:version??0});
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
 try{await window.CadDemoLogin.client().saveCloudSetting({agency:session().agencyId,scope:'AGENCY',key:KEY,payload:{raw:JSON.stringify([...plans,...additions])},expectedVersion:version??0});await reload();status('Imported '+additions.length+' plans as drafts. Review call-type links and requirements before activation.');}
 catch(e){status('Import blocked: '+e.message)}
}
document.getElementById('cadConfigSection')?.addEventListener('change',e=>{if(e.target.value==='response')reload()});
window.addEventListener('cad-cloud-settings-applied',e=>{if(e.detail?.keys?.includes(KEY))reload()});
draw();
})();
