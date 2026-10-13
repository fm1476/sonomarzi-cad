/* Fire/EMS response plans: browser-local configuration prototype, not live dispatch. */
(()=>{'use strict';
const KEY='smcad-response-plans-v1',CREWS='smcad-shared-crews-v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
let plans=read(KEY),crews=read(CREWS);
const root=document.getElementById('cadResponseDesigner');if(!root)return;
const el=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(plans));localStorage.setItem(CREWS,JSON.stringify(crews))};
const escape=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let discipline='FIRE',zone='',zoneMap=null,zoneOverlay=null,zoneAbort=null,mapObserver=null;
const INITIAL_CENTER=[38.2448,-122.6400], INITIAL_ZOOM=13;
const gis={FIRE:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},EMS:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Fire/FireWebApp_MIL/MapServer/11',field:'ESZ_NUM'},LAW:{url:'https://maps.cityofpetaluma.net/mapping/rest/services/Police/DistrictPolicing_Public_MIL1/FeatureServer/1',field:'PD_BEAT'}};
function render(){
 // Tear down Leaflet before replacing its container. Discipline switches must recreate a fresh map.
 zoneAbort?.abort();zoneAbort=null;
 if(mapObserver){mapObserver.disconnect();mapObserver=null}
 if(zoneMap){zoneMap.off();zoneMap.remove();zoneMap=null;zoneOverlay=null}
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
 zoneMap=L.map('rpZoneMap',{scrollWheelZoom:false}).setView(INITIAL_CENTER,INITIAL_ZOOM);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(zoneMap);
 zoneOverlay=L.geoJSON(null,{style:f=>({color:zone===featureZone(f)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(f)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}),onEachFeature:(f,layer)=>{
 const id=featureZone(f);layer.bindTooltip(id||'Unnamed area',{sticky:true});
 layer.on('click',()=>{if(!id)return;zone=id;el('rpZone').value=id;zoneOverlay.setStyle(x=>({color:zone===featureZone(x)?'#f7d66b':'#5cb3e6',weight:zone===featureZone(x)?3:1.2,fillColor:'#50a2d4',fillOpacity:.12}));showPlans();msg('Selected '+discipline+' zone '+id+'.')});
 }}).addTo(zoneMap);
 zoneMap.on('moveend',loadMapZones);
 const host=el('rpZoneMap');let lastWidth=0,lastHeight=0,initialSized=false;
 function fixSize(){if(!zoneMap||!host||!host.isConnected)return;const box=host.getBoundingClientRect();if(box.width<100||box.height<100)return;if(Math.abs(box.width-lastWidth)<2&&Math.abs(box.height-lastHeight)<2)return;lastWidth=box.width;lastHeight=box.height;requestAnimationFrame(()=>{if(zoneMap&&host.isConnected){zoneMap.invalidateSize({pan:false,animate:false});if(!initialSized){initialSized=true;zoneMap.setView(INITIAL_CENTER,INITIAL_ZOOM,{animate:false})}}})}
 if(window.ResizeObserver){mapObserver=new ResizeObserver(fixSize);mapObserver.observe(host)}
 const visibleObserver=new MutationObserver(fixSize);visibleObserver.observe(document.querySelector('[data-config-panel="master"]')||root,{attributes:true,attributeFilter:['hidden','style','class']});
 const previousObserver=mapObserver;mapObserver={disconnect(){previousObserver?.disconnect();visibleObserver.disconnect()}};
 setTimeout(fixSize,150);setTimeout(fixSize,650);
 setTimeout(()=>{if(zoneMap&&host.isConnected){zoneMap.invalidateSize({pan:false,animate:false});loadMapZones()}},250);
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
const RESOURCE_TYPES={
 FIRE:['ENGINE','TRUCK','LADDER','RESCUE','BRUSH','CHIEF','TENDER','MEDIC','AMBULANCE','OTHER'],
 EMS:['AMBULANCE','MEDIC','ENGINE','RESCUE','CHIEF','SUPERVISOR','OTHER'],
 LAW:['PATROL','SUPERVISOR','TRAFFIC','K9','DETECTIVE','SWAT','MOTOR','OTHER']
};
function edit(id){
 const p=plans.find(x=>x.id===id);
 const defaults=discipline==='LAW'?[{type:'PATROL',count:2},{type:'SUPERVISOR',count:1}]:discipline==='EMS'?[{type:'AMBULANCE',count:1},{type:'ENGINE',count:1}]:[{type:'ENGINE',count:2},{type:'TRUCK',count:1},{type:'CHIEF',count:1}];
 let resources=(p?.resources||defaults).map(r=>({...r}));
 const options=RESOURCE_TYPES[discipline];
 el('rpEditor').innerHTML='<h4>'+(p?'Edit Plan':'New Plan')+' — '+escape(discipline==='LAW'?'Beat ':'ESZ ')+escape(zone)+'</h4>'+
 '<label>Call type<input id="rpType" value="'+escape(p?.type||(discipline==='LAW'?'Priority Emergency':discipline==='EMS'?'Medical Emergency':'Structure Fire'))+'"></label>'+
 '<label>Response level<select id="rpLevel"><option>First Alarm</option><option>Working Fire</option><option>Second Alarm</option><option>Standard</option></select></label>'+
 '<label>Selection method<select id="rpMethod"><option>HYBRID</option><option>CLOSEST</option><option>RUN_CARD</option></select></label>'+
 '<h4>Response resources</h4><p>Choose resource types, set quantities, and use the arrows to establish dispatch order.</p>'+
 '<div id="rpResourceCards"></div><button id="rpAddResource" type="button">+ Add Resource</button>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button id="rpDraft" type="button">Save Draft</button><button id="rpPublish" type="button">Publish Locally</button></div>';
 el('rpLevel').value=p?.level||'Standard';el('rpMethod').value=p?.method||'HYBRID';
 function drawResources(){
  el('rpResourceCards').innerHTML=resources.map((resource,i)=>'<div data-resource-index="'+i+'" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid #34536d;border-radius:10px;padding:12px;margin:8px 0;background:rgba(31,75,109,.22)">'+
   '<strong style="min-width:30px">'+(i+1)+'.</strong>'+
   '<label style="flex:1;min-width:160px">Resource type<select data-resource-type="'+i+'">'+[...new Set([...options,resource.type])].map(type=>'<option value="'+escape(type)+'" '+(resource.type===type?'selected':'')+'>'+escape(type)+'</option>').join('')+'</select></label>'+
   '<label style="min-width:100px">Quantity<input type="number" min="1" max="99" style="width:85px" data-resource-count="'+i+'" value="'+escape(resource.count)+'"></label>'+
   '<button type="button" data-resource-up="'+i+'" '+(i===0?'disabled':'')+' aria-label="Move resource up">↑</button>'+
   '<button type="button" data-resource-down="'+i+'" '+(i===resources.length-1?'disabled':'')+' aria-label="Move resource down">↓</button>'+
   '<button type="button" data-resource-remove="'+i+'" aria-label="Remove resource">Remove</button></div>').join('')||'<p>No resources yet. Add one to begin.</p>';
  el('rpResourceCards').querySelectorAll('[data-resource-type]').forEach(x=>x.onchange=()=>{resources[Number(x.dataset.resourceType)].type=x.value});
  el('rpResourceCards').querySelectorAll('[data-resource-count]').forEach(x=>x.onchange=()=>{resources[Number(x.dataset.resourceCount)].count=Number(x.value)});
  el('rpResourceCards').querySelectorAll('[data-resource-up]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.resourceUp);[resources[i-1],resources[i]]=[resources[i],resources[i-1]];drawResources()});
  el('rpResourceCards').querySelectorAll('[data-resource-down]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.resourceDown);[resources[i+1],resources[i]]=[resources[i],resources[i+1]];drawResources()});
  el('rpResourceCards').querySelectorAll('[data-resource-remove]').forEach(x=>x.onclick=()=>{resources.splice(Number(x.dataset.resourceRemove),1);drawResources()});
 }
 drawResources();
 el('rpAddResource').onclick=()=>{resources.push({type:options[0],count:1});drawResources()};
 function commit(status){
  const type=el('rpType').value.trim();
  if(!type||!resources.length||resources.some(r=>!r.type||!Number.isInteger(r.count)||r.count<1||r.count>99))return msg('Enter a call type and at least one resource with a quantity from 1 to 99.');
  const next={id:id||crypto.randomUUID(),zone,discipline,type,level:el('rpLevel').value,method:el('rpMethod').value,resources:resources.map(r=>({...r})),status};
  plans=plans.filter(x=>x.id!==id);plans.push(next);save();showPlans();msg('Saved '+status+' locally. No live dispatch changes.');
 }
 el('rpDraft').onclick=()=>commit('Draft');el('rpPublish').onclick=()=>commit('Published');
}
window.CadResponsePlans={openZone(z,d='FIRE'){zone=String(z);discipline=['EMS','LAW'].includes(d)?d:'FIRE';render()},sharedCrewConflicts:ids=>{const used=new Set();return ids.filter(id=>{const g=crews.find(x=>x.units.includes(id));if(!g)return false;if(used.has(g.id))return true;used.add(g.id);return false})}};
render();
})();