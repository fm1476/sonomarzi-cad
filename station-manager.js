/* Browser-local facilities and station coverage prototype. */
(()=>{'use strict';
const KEY='smcad-facilities-v1',MOVES='smcad-station-moveups-v1',host=document.getElementById('cadStationManager');if(!host)return;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
let facilities=read(KEY),moves=read(MOVES),map,markers,selected=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const master=()=>window.CadAgencyMaster?.read(localStorage)||{agencies:[],units:[]};
const roster=()=>window.cadSafetyState?.().units||[];
const save=()=>{localStorage.setItem(KEY,JSON.stringify(facilities));localStorage.setItem(MOVES,JSON.stringify(moves))};
const agencyName=id=>master().agencies.find(a=>a.id===id)?.name||'';
function unitList(){const m=master();return [...new Map([...m.units.map(u=>[u.designator,{id:u.designator,agency:agencyName(u.agencyId),type:u.resourceType,home:u.homeStationId}]),...roster().map(u=>[u.id,{id:u.id,agency:u.agency,type:m.units.find(x=>x.id===u.masterUnitId)?.resourceType||'',home:m.units.find(x=>x.id===u.masterUnitId)?.homeStationId}])]).values()]}
function coverage(f){const units=unitList();const active=moves.filter(m=>m.stationId===f.id&&m.status!=='ENDED');const covered=units.filter(u=>u.home===f.id||active.some(m=>m.unitId===u.id&&m.status==='ARRIVED'));const eligible=covered.filter(u=>{const live=roster().find(x=>x.id===u.id);return live?.status==='AVAILABLE'});const required=Number(f.minCoverage||1);return {eligible,covered,required,ok:eligible.length>=required,active}}
function render(){
 const m=master(),agencies=m.agencies;
 host.innerHTML='<div class="cad-station-header"><div><h3>Stations & Facilities</h3><p>Map-driven station definitions, apparatus home assignments, and move-up coverage. Browser-local prototype.</p></div><button type="button" id="sfNew">+ Add Facility</button></div><div class="cad-station-layout"><div><div class="cad-station-map" id="sfMap"></div><p class="cad-station-hint">Click the map to set a facility location. Drag a pin to correct its coordinates. The map does not auto-zoom.</p><div id="sfCards" class="cad-station-cards"></div></div><div class="cad-station-editor"><h4>Facility details</h4><label>Facility name<input id="sfName" placeholder="Station 2"></label><label>Owning agency<select id="sfAgency">'+agencies.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select></label><label>Facility type<select id="sfType"><option>Fire Station</option><option>Police Station</option><option>EMS Post</option><option>Staging Area</option><option>Other Facility</option></select></label><label>Street address<input id="sfAddress" placeholder="Address (optional)"></label><div class="cad-station-coords"><label>Latitude<input id="sfLat" type="number" step="any" placeholder="38.24"></label><label>Longitude<input id="sfLng" type="number" step="any" placeholder="-122.64"></label></div><label>Minimum available units<input id="sfMinimum" type="number" min="0" max="50" value="1"></label><div class="cad-station-actions"><button id="sfSave" type="button">Save Facility</button><button id="sfDelete" type="button">Remove</button></div><p id="sfMessage" role="status"></p><hr><h4>Home apparatus</h4><p>Assign a permanent unit home station.</p><div id="sfHomeUnits"></div><hr><h4>Move-up & station coverage</h4><p>Move-up orders do not count as coverage until the unit arrives and is available.</p><div id="sfMoveUnits"></div><div id="sfMoveHistory"></div></div></div>';
 document.getElementById('sfNew').onclick=()=>{selected=null;fill();};
 document.getElementById('sfSave').onclick=saveFacility;
 document.getElementById('sfDelete').onclick=()=>{if(!selected)return;if(!confirm('Remove this facility?'))return;facilities=facilities.filter(f=>f.id!==selected);moves=moves.filter(x=>x.stationId!==selected);selected=null;save();render()};
 document.getElementById('sfAgency').onchange=drawDetails;
 setupMap();drawCards();fill();
}
function setupMap(){
 if(!window.L){document.getElementById('sfMap').textContent='Map unavailable; enter coordinates manually.';return}
 map=L.map('sfMap').setView([38.2324,-122.6367],12);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 markers=L.layerGroup().addTo(map);
 map.on('click',e=>{document.getElementById('sfLat').value=e.latlng.lat.toFixed(6);document.getElementById('sfLng').value=e.latlng.lng.toFixed(6);document.getElementById('sfMessage').textContent='Location selected. Save the facility to place its pin.'});
 setTimeout(()=>map?.invalidateSize({pan:false}),200);
}
function drawPins(){if(!markers)return;markers.clearLayers();facilities.filter(f=>Number.isFinite(f.lat)&&Number.isFinite(f.lng)).forEach(f=>{const marker=L.marker([f.lat,f.lng],{draggable:true}).addTo(markers).bindTooltip(f.name);marker.on('click',()=>{selected=f.id;fill();drawCards()});marker.on('dragend',()=>{const pos=marker.getLatLng();f.lat=pos.lat;f.lng=pos.lng;save();if(selected===f.id)fill();document.getElementById('sfMessage').textContent='Pin coordinates saved.'})})}
function drawCards(){const host=document.getElementById('sfCards');host.innerHTML=facilities.map(f=>{const c=coverage(f);return '<button class="cad-station-card '+(selected===f.id?'is-selected':'')+'" data-sf="'+esc(f.id)+'"><span><strong>'+esc(f.name)+'</strong><small>'+esc(agencyName(f.agencyId))+' · '+esc(f.type)+'</small></span><span class="cad-station-status '+(c.ok?'is-covered':'is-gap')+'">'+(c.ok?'Covered':'Coverage gap')+' · '+c.eligible.length+'/'+c.required+'</span></button>'}).join('')||'<p>No facilities configured yet. Add one using the form or map.</p>';host.querySelectorAll('[data-sf]').forEach(b=>b.onclick=()=>{selected=b.dataset.sf;fill();drawCards()});drawPins()}
function fill(){const f=facilities.find(x=>x.id===selected),set=(id,v)=>document.getElementById(id).value=v??'';set('sfName',f?.name);set('sfAgency',f?.agencyId||master().agencies[0]?.id);set('sfType',f?.type||'Fire Station');set('sfAddress',f?.address);set('sfLat',f?.lat);set('sfLng',f?.lng);set('sfMinimum',f?.minCoverage??1);drawDetails()}
function saveFacility(){const get=id=>document.getElementById(id).value.trim();const lat=Number(get('sfLat')),lng=Number(get('sfLng')),minimum=Number(get('sfMinimum'));if(!get('sfName')||!get('sfAgency')||!get('sfLat')||!get('sfLng')||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isInteger(minimum)||minimum<0)return document.getElementById('sfMessage').textContent='Provide a name, agency, valid coordinates, and nonnegative coverage minimum.';const f={id:selected||crypto.randomUUID(),name:get('sfName'),agencyId:get('sfAgency'),type:get('sfType'),address:get('sfAddress'),lat,lng,minCoverage:minimum};facilities=facilities.filter(x=>x.id!==f.id).concat(f);selected=f.id;save();drawCards();fill();document.getElementById('sfMessage').textContent='Facility saved locally.'}
function drawDetails(){const f=facilities.find(x=>x.id===selected),home=document.getElementById('sfHomeUnits'),move=document.getElementById('sfMoveUnits'),history=document.getElementById('sfMoveHistory');if(!f){home.innerHTML='<p>Save a facility first.</p>';move.innerHTML='';history.innerHTML='';return}
 const m=master(),defs=m.units.filter(u=>u.agencyId===f.agencyId);
 home.innerHTML='<div class="cad-station-unit-list">'+defs.map(u=>'<label class="cad-station-unit"><span>'+esc(u.designator)+' <small>'+esc(u.resourceType||'')+'</small></span><input type="checkbox" data-home-unit="'+esc(u.id)+'" '+(u.homeStationId===f.id?'checked':'')+'></label>').join('')+'</div>';
 home.querySelectorAll('[data-home-unit]').forEach(input=>input.onchange=()=>{const def=m.units.find(u=>u.id===input.dataset.homeUnit);def.homeStationId=input.checked?f.id:null;try{window.CadAgencyMaster.save(localStorage,m);drawCards()}catch(e){document.getElementById('sfMessage').textContent=e.message}});
 const units=unitList(),c=coverage(f);
 move.innerHTML='<label>Unit<select id="sfMoveUnit"><option value="">Select apparatus</option>'+units.map(u=>'<option value="'+esc(u.id)+'">'+esc(u.id)+' — '+esc(u.agency)+'</option>').join('')+'</select></label><button type="button" id="sfMoveOrder">Order Move-up</button><div class="cad-station-move-list">'+c.active.map(x=>'<div class="cad-station-move"><strong>'+esc(x.unitId)+'</strong><span>'+esc(x.status)+'</span><button data-arrive="'+esc(x.id)+'" '+(x.status==='ARRIVED'?'disabled':'')+'>Arrived</button><button data-end="'+esc(x.id)+'">End Coverage</button></div>').join('')+'</div>';
 document.getElementById('sfMoveOrder').onclick=()=>{const id=document.getElementById('sfMoveUnit').value;if(!id)return;const conflict=moves.find(x=>x.unitId===id&&x.status!=='ENDED');if(conflict)return document.getElementById('sfMessage').textContent=id+' already has an active move-up assignment.';moves.push({id:crypto.randomUUID(),unitId:id,stationId:f.id,status:'ORDERED',orderedAt:new Date().toISOString()});save();drawCards();drawDetails()};
 move.querySelectorAll('[data-arrive]').forEach(b=>b.onclick=()=>{const x=moves.find(x=>x.id===b.dataset.arrive);x.status='ARRIVED';x.arrivedAt=new Date().toISOString();save();drawCards();drawDetails()});
 move.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>{const x=moves.find(x=>x.id===b.dataset.end);x.status='ENDED';x.endedAt=new Date().toISOString();save();drawCards();drawDetails()});
 history.innerHTML='<p class="cad-station-hint">Coverage is based on AVAILABLE roster status, permanent home units, and arrived move-up units. No automatic dispatch or verified GPS is used.</p>';
}
window.CadFacilities={getAll:()=>structuredClone(facilities),coverage:id=>{const f=facilities.find(x=>x.id===id);return f?coverage(f):null},getMoveUps:()=>structuredClone(moves)};
render();
const section=document.querySelector('[data-config-panel="stations"]');
const picker=document.getElementById('cadConfigSection');
function revealStationPanel(){
 if(!section||!picker)return;
 const active=picker.value==='stations';
 if(active){section.hidden=false;section.style.display='block';setTimeout(()=>{map?.invalidateSize({pan:false,animate:false});drawCards()},40)}
 else{section.hidden=true;section.style.display=''}
}
picker?.addEventListener('change',()=>setTimeout(revealStationPanel,0));
revealStationPanel();
})();