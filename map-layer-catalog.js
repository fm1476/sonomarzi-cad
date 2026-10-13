/* Public reference GIS layer catalog, all disabled by default. Not a live dispatch authority. */
(()=>{'use strict';
const pet='https://maps.cityofpetaluma.net/mapping/rest/services';
const county='https://socogis.sonomacounty.ca.gov/map/rest/services';
const base=pet+'/Basemaps/COFP_BASEMAP_PUBLIC/MapServer';
const LIST=[
 {id:'hydrants',name:'Fire Hydrants',category:'Fire & EMS',special:true,terms:['fire hydrant','hydrant']},
 {id:'petaluma-esz',name:'Petaluma Fire Response Zones (ESZ)',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/11',color:'#ff886b',terms:['fire response zones','petaluma esz','fire esz','fire zones','response zones']},
 {id:'ems-esz',name:'EMS Emergency Service Zones',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/18',color:'#6fc8ed',terms:['ems response zones','ems esz','ems zones']},
 {id:'ambulance-area',name:'Sonoma Ambulance Response Areas',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/9',color:'#e8a2db',terms:['ambulance response areas','ambulance zones']},
 {id:'bls-area',name:'BLS Response Areas',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/6',color:'#76d6a2',terms:['bls response areas','bls zones']},
 {id:'mutual-threat',name:'Mutual Threat Zones',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/3',color:'#e8c36d',terms:['mutual threat zones','mutual threat']},
 {id:'fire-districts',name:'Sonoma Fire District Boundaries',category:'Fire & EMS',url:county+'/BASEPublic/Fire_Districts/FeatureServer/0',color:'#b9a0ff',terms:['fire districts','fire district boundaries']},
 {id:'stations',name:'Fire Stations',category:'Fire & EMS',url:county+'/BASEPublic/Fire_Stations/FeatureServer/0',color:'#ff9b72',terms:['fire station','station locations']},
 {id:'firehazard',name:'Fire Hazard Zones',category:'Fire & EMS',url:pet+'/Planning/Development_Related/MapServer/2',color:'#f57d67',terms:['fire hazard','hazard zones']},
 {id:'wui',name:'Wildland Urban Interface',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/2',color:'#efb75a',terms:['wildland urban','wildland interface','wui']},
 {id:'evac',name:'Evacuation Zones',category:'Emergency Management',url:'https://services1.arcgis.com/P5Mv5GY5S66M8Z1Q/ArcGIS/rest/services/Sonoma_County_Evacuation_Areas_public/FeatureServer/0',color:'#f2c15b',terms:['evacuation zones','evacuation zone','evac zones']},
 {id:'flood',name:'Flood Zones',category:'Emergency Management',url:pet+'/Fire/FireWebApp_MIL/MapServer/28',color:'#59adff',terms:['flood zones','flood zone','floodplain']},
 {id:'beats',name:'Police Beats',category:'Law Enforcement',url:pet+'/Police/DistrictPolicing_Public_MIL1/FeatureServer/1',color:'#74aaff',terms:['police beats','patrol beats','police districts']},
 {id:'sheriff',name:'Sheriff Patrol Zones',category:'Law Enforcement',url:county+'/SCSDPublic/Sheriff_Patrol_Zones/FeatureServer/0',color:'#a795e8',terms:['sheriff patrol zones','sheriff zones','sheriff beats']},
 {id:'addresses',name:'Address Points',category:'Geographic Reference',url:base+'/0',color:'#e6f09d',minZoom:15,terms:['address points','addresses layer']},
 {id:'buildings',name:'Building Footprints',category:'Geographic Reference',url:base+'/4',color:'#e1a9ec',minZoom:14,terms:['building footprints','buildings']},
 {id:'schools',name:'Schools',category:'Geographic Reference',url:base+'/6',color:'#63d3bd',terms:['schools','school locations']},
 {id:'parcels',name:'Parcels',category:'Geographic Reference',url:base+'/9',color:'#b2c6d7',minZoom:15,terms:['parcels','property lines','parcel boundaries']},
 {id:'roads',name:'Road Closures & Traffic Incidents',category:'Transportation',unavailable:true,terms:['road closures','traffic incidents','road closure','traffic incident']}
];
const key='smcad-gis-overlays-v20.8';
window.CadMapLayerCatalog=(map,api)=>{
 let active=new Set();try{const ids=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(ids))active=new Set(ids.filter(v=>LIST.some(x=>x.id===v&&!x.unavailable)))}catch{}
 const layers=new Map(),pending=new Map();let generation=0,mountNode=null;
 function report(s){api.setResult(s)}
 function save(){localStorage.setItem(key,JSON.stringify([...active]))}
 function paint(){if(!mountNode)return;mountNode.querySelectorAll('input[data-layer]').forEach(el=>el.checked=active.has(el.dataset.layer))}
 function set(id,on,{quiet=false}={}){const l=LIST.find(x=>x.id===id);if(!l)return false;if(l.unavailable){report(`${l.name}: verified live feed not yet available; nothing was added.`);return true}
  if(on)active.add(id);else active.delete(id);save();paint();if(id==='hydrants'){on?api.showHydrants():api.hideHydrants();return true}
  if(!on){pending.get(id)?.abort();layers.get(id)?.clearLayers();if(!quiet)report(`${l.name} hidden. Map view unchanged.`)}else{void load(l);if(!quiet)report(`${l.name} enabled for current map view. Zoom and center unchanged.`)}return true;
 }
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function fieldText(p){return Object.entries(p||{}).filter(([k,v])=>v!=null&&typeof v!=='object'&&String(v).length<90&& !/^objectid|shape_|globalid/i.test(k)).slice(0,5).map(([k,v])=>`<b>${esc(k)}</b>: ${esc(v)}`).join('<br>')}
 async function load(item){if(!active.has(item.id)||!item.url)return;
  if(item.minZoom&&map.getZoom()<item.minZoom){layers.get(item.id)?.clearLayers();report(`${item.name}: zoom to level ${item.minZoom} or closer to display detailed features.`);return}
  const controller=new AbortController();pending.get(item.id)?.abort();pending.set(item.id,controller);
  const args=window.CadGISQuery.params(map.getBounds());
  try{const res=await fetch(item.url+'/query?'+args,{signal:controller.signal});if(!res.ok)throw Error(`GIS HTTP ${res.status}`);const data=await res.json();if(!active.has(item.id)||pending.get(item.id)!==controller||map._popup?.isOpen?.())return;if(data.error)throw Error(data.error.message||'GIS query error');
   let group=layers.get(item.id);if(!group){group=L.layerGroup().addTo(map);layers.set(item.id,group)}group.clearLayers();
   if(data.type!=='FeatureCollection')throw Error('GeoJSON response unavailable');
   L.geoJSON(data,{style:{color:item.color,weight:2,fillColor:item.color,fillOpacity:.11,opacity:.8},pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{radius:5,color:item.color,weight:2,fillOpacity:.45,fillColor:item.color}),onEachFeature:(f,layer)=>layer.bindPopup(`<strong>${esc(item.name)}</strong><br>${fieldText(f.properties)}<br><small>Public GIS reference; verify before use.</small>`,{autoPan:false,closeButton:true,autoClose:false})}).addTo(group);
   if(data.features.length>=500)report(`${item.name}: showing up to 500 features. Zoom closer for more detail.`);
  }catch(e){if(e.name==='AbortError')return;layers.get(item.id)?.clearLayers();report(`${item.name} unavailable from its GIS provider: ${e.message}. Map unchanged.`)}
 }
 function refresh(){if(map.isPopupOpen?.()||map._popup?.isOpen?.())return;for(const item of LIST)if(active.has(item.id)&&!item.special&&!item.unavailable)void load(item)}
 map.on('moveend zoomend',refresh); // Data is viewport-scoped, never repositions map.
 map.on('popupopen',()=>{for(const request of pending.values())request.abort()});
 function mount(host){if(!host)return;mountNode=host;const wrap=document.createElement('details');wrap.className='cad-gis-layers';wrap.innerHTML='<summary aria-label="Layers">Layers ▾</summary><div class="cad-gis-options"></div>';host.appendChild(wrap);
  let category='';const content=wrap.querySelector('.cad-gis-options');for(const item of LIST){if(item.category!==category){category=item.category;const h=document.createElement('strong');h.textContent=category;content.appendChild(h)}const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.dataset.layer=item.id;cb.disabled=!!item.unavailable;cb.checked=active.has(item.id);cb.onchange=()=>set(item.id,cb.checked);label.append(cb,document.createTextNode(' '+item.name+(item.unavailable?' (feed unavailable)':'')));content.appendChild(label)}
  wrap.addEventListener('pointerdown',e=>e.stopPropagation());refresh();
 }
 async function voice(raw){
  const intent=window.CadLayerIntent.parse(raw,LIST);
  if(!intent)return false;
  if(intent.action==='clear'){
   for(const id of [...active])set(id,false,{quiet:true});
   report('All optional map layers hidden. Map center and zoom unchanged.');return true;
  }
  if(intent.only)for(const id of [...active])if(!intent.ids.includes(id))set(id,false,{quiet:true});
  for(const id of intent.ids)set(id,intent.action==='show',{quiet:true});
  const names=LIST.filter(x=>intent.ids.includes(x.id)).map(x=>x.name);
  report((intent.action==='hide'?'Hidden':'Selected')+': '+names.join(', ')+'. Map zoom and center preserved.');return true;
 }

 // Read-only point-in-polygon lookup for future response-plan simulation.
 // No published response assignment is inferred from these reference boundaries.
 async function lookupZone(lat,lng,kind='fire'){
  const layer=kind==='ems'?18:11;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))throw Error('Valid latitude and longitude required');
  const url=pet+'/Fire/FireWebApp_MIL/MapServer/'+layer+'/query';
  const params=new URLSearchParams({geometry:JSON.stringify({x:Number(lng),y:Number(lat),spatialReference:{wkid:4326}}),geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'ESZ_NUM,AGENCY,PLY_NAME,NAME',returnGeometry:'false',f:'json'});
  const response=await fetch(url+'?'+params);if(!response.ok)throw Error('Zone lookup HTTP '+response.status);
  const data=await response.json();if(data.error)throw Error(data.error.message||'Zone lookup error');
  return {kind,features:(data.features||[]).map(f=>f.attributes),source:url,authority:'PUBLIC_GIS_REFERENCE_ONLY'};
 }
 window.CadFireZoneLookup=lookupZone;
 return{mount,voice,set,refresh,items:LIST};
};
})();
