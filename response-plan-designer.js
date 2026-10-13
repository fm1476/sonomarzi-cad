/* Fire/EMS response plans: browser-local configuration prototype, not live dispatch. */
(()=>{'use strict';
const KEY='smcad-response-plans-v1',CREWS='smcad-shared-crews-v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
let plans=read(KEY),crews=read(CREWS);
const root=document.getElementById('cadResponseDesigner');if(!root)return;
const el=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(plans));localStorage.setItem(CREWS,JSON.stringify(crews))};
const escape=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let discipline='FIRE',zone='',zoneMap=null,zoneOverlay=null,zoneAbort=null;
const gis={FIRE:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},EMS:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},LAW:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/EnerGov/EnerGov_Display/MapServer/10',field:null}};
function render(){
 const zones=[...new Set(plans.filter(p=>p.discipline===discipline).map(p=>p.zone))];
 root.innerHTML='<h4>Response Plan Designer</h4><p>Local draft/publish prototype. Does not affect live dispatch.</p><label>Discipline<select id="rpDisc"><option>FIRE</option><option>EMS</option><option>LAW</option></select></label><label>Response zone / police beat<input id="rpZone" placeholder="Click a polygon on the map, or enter a zone ID" value="'+escape(zone)+'"></label><div id="rpZoneMap" style="height:370px;min-height:300px;border:1px solid #34536d;border-radius:10px;margin:12px 0;overflow:hidden" aria-label="Select response zone on map"></div><p id="rpMapStatus">Loading response area map…</p><button id="rpOpen" type="button">Open Zone</button><button id="rpNew" type="button">New Plan</button><div id="rpPlans"></div><div id="rpEditor"></div><h4>Shared Crew Groups</h4><p>Apparatus sharing a crew cannot be recommended as independently staffed resources.</p><label>Group name<input id="rpCrewName" placeholder="Station 1 primary crew"></label><label>Apparatus (comma separated)<input id="rpCrewUnits" placeholder="E1, R1, BR1"></label><button id="rpAddCrew" type="button">Add Shared Crew</button><div id="rpCrews"></div><p id="rpMessage" role="status"></p>';
 el('rpDisc').value=discipline;el('rpDisc').onchange=e=>{discipline=e.target.value;zone='';render()};
 el('rpOpen').onclick=()=>{zone=el('rpZone').value.trim();showPlans()};
 el('rpNew').onclick=()=>{zone=el('rpZone').value.trim();if(!zone)return msg('Select an ESZ first.');edit()};
 el('rpAddCrew').onclick=()=>{const name=el('rpCrewName').value.trim(),units=[...new Set(el('rpCrewUnits').value.toUpperCase().split(',').map(s=>s.trim()).filter(Boolean))];if(!name||units.length<2)return msg('Provide a group name and at least two apparatus.');crews.push({id:crypto.randomUUID(),name,units});save();showCrews();msg('Shared crew saved locally.')};
 showPlans();showCrews();initZoneMap();
}
function initZoneMap(){
 if(!window.L){msg('Map library unavailable. Zone IDs can still be entered manually.');return}
 if(zoneMap){zoneMap.remove();zoneMap=null}
 zoneMap=L.map('rpZoneMap',{scrollWheelZoom:false}).setView([38.2324,-122.6367],12);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(zoneMap);
 zoneOverlay=L.geoJSON(null,{style:f=>({color:zone===featureZone(f)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(f)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}),onEachFeature:(f,layer)=>{
 const id=featureZone(f);layer.bindTooltip(id||'Unnamed area',{sticky:true});
 layer.on('click',()=>{if(!id)return;zone=id;el('rpZone').value=id;zoneOverlay.setStyle(x=>({color:zone===featureZone(x)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(x)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}));showPlans();msg('Selected '+discipline+' zone '+id+'.')});
 }}).addTo(zoneMap);
 zoneMap.on('moveend',loadMapZones);setTimeout(()=>{zoneMap?.invalidateSize();loadMapZones()},150);
}
function featureZone(f){
 const p=f.properties||{},configured=gis[discipline].field;
 if(configured&&p[configured]!=null)return String(p[configured]);
 for(const k of ['BEAT','BEAT_NAME','BEAT_NUM','BEAT_NUMBER','BEAT_ID','NAME','ZONE','ZONE_NAME','DISTRICT','AREA','LABEL'])if(p[k]!=null&&String(p[k]).trim())return String(p[k]);
 const found=Object.entries(p).find(([k,v])=>/beat|zone|district|area/i.test(k)&&v!=null&&typeof v!=='object');
 return found?String(found[1]):String(p.OBJECTID||p.ObjectId||'');
}
async function loadMapZones(){
 if(!zoneMap||!zoneOverlay)return;
 zoneAbort?.abort();const controller=new AbortController();zoneAbort=controller;
 const bounds=zoneMap.getBounds(),sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
 const params=new URLSearchParams({geometry:JSON.stringify({xmin:sw.lng,ymin:sw.lat,xmax:ne.lng,ymax:ne.lat,spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',outSR:'4326',f:'geojson',resultRecordCount:'500'});
 try{
 const response=await fetch(gis[discipline].url+'/query?'+params,{signal:controller.signal});
 if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();
 if(controller!==zoneAbort||!zoneMap)return;if(data.error)throw Error(data.error.message||'GIS service error');
 if(data.type!=='FeatureCollection')throw Error('GIS service did not return GeoJSON');
 zoneOverlay.clearLayers();zoneOverlay.addData(data);
 el('rpMapStatus').textContent=data.features.length+' '+discipline+' GIS features shown. Click a zone or beat to open its plans. Map position is unchanged.';
 }catch(e){if(e.name!=='AbortError'&&el('rpMapStatus'))el('rpMapStatus').textContent='GIS layer unavailable: '+e.message+'. Manual zone entry remains available.'}
}
function msg(t){el('rpMessage').textContent=t}
function showCrews(){el('rpCrews').innerHTML=crews.map(g=>'<p>'+escape(g.name)+' — '+escape(g.units.join(', '))+' <button data-remove-crew="'+escape(g.id)+'">Remove</button></p>').join('')||'<p>No shared crew groups configured.</p>';el('rpCrews').querySelectorAll('[data-remove-crew]').forEach(b=>b.onclick=()=>{crews=crews.filter(g=>g.id!==b.dataset.removeCrew);save();showCrews()})}
function showPlans(){el('rpZone').value=zone;const matches=plans.filter(p=>p.zone===zone&&p.discipline===discipline);el('rpPlans').innerHTML=matches.map(p=>'<p>'+escape(p.type)+' · '+escape(p.level)+' · '+escape(p.status)+' <button data-edit-plan="'+escape(p.id)+'">Edit</button></p>').join('')||(zone?'<p>No existing plans for this ESZ.</p>':'<p>Select an ESZ to begin.</p>');el('rpPlans').querySelectorAll('[data-edit-plan]').forEach(b=>b.onclick=()=>edit(b.dataset.editPlan));if(matches.length===1)edit(matches[0].id);else el('rpEditor').innerHTML=''}
function edit(id){const p=plans.find(x=>x.id===id);el('rpEditor').innerHTML='<h4>'+(p?'Edit Plan':'New Plan')+' — ESZ '+escape(zone)+'</h4><label>Call type<input id="rpType" value="'+escape(p?.type||'Structure Fire')+'"></label><label>Response level<select id="rpLevel"><option>First Alarm</option><option>Working Fire</option><option>Second Alarm</option><option>Standard</option></select></label><label>Selection method<select id="rpMethod"><option>HYBRID</option><option>CLOSEST</option><option>RUN_CARD</option></select></label><label>Resources (one per line: TYPE,QUANTITY)<textarea id="rpResources"></textarea></label><button id="rpDraft">Save Draft</button> <button id="rpPublish">Publish Locally</button>';
 el('rpLevel').value=p?.level||'First Alarm';el('rpMethod').value=p?.method||'HYBRID';el('rpResources').value=(p?.resources||[{type:'ENGINE',count:2},{type:'TRUCK',count:1},{type:'CHIEF',count:1}]).map(r=>r.type+','+r.count).join('\n');
 function commit(status){const type=el('rpType').value.trim();const resources=el('rpResources').value.split('\n').filter(x=>x.trim()).map(line=>{const [type,count]=line.split(',');return{type:type?.trim().toUpperCase(),count:Number(count)}});if(!type||!resources.length||resources.some(r=>!r.type||!Number.isInteger(r.count)||r.count<1))return msg('Enter a call type and valid TYPE,QUANTITY resources.');plans=plans.filter(x=>x.id!==id);plans.push({id:id||crypto.randomUUID(),zone,discipline,type,level:el('rpLevel').value,method:el('rpMethod').value,resources,status});save();showPlans();msg('Saved '+status+' locally. No live dispatch changes.')}
 el('rpDraft').onclick=()=>commit('Draft');el('rpPublish').onclick=()=>commit('Published');
}
window.CadResponsePlans={openZone(z,d='FIRE'){zone=String(z);discipline=['EMS','LAW'].includes(d)?d:'FIRE';render()},sharedCrewConflicts:ids=>{const used=new Set();return ids.filter(id=>{const g=crews.find(x=>x.units.includes(id));if(!g)return false;if(used.has(g.id))return true;used.add(g.id);return false})}};
render();
})();