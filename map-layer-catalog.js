/* Public reference GIS layer catalog, all disabled by default. Not a live dispatch authority. */
(()=>{'use strict';
const pet='https://maps.cityofpetaluma.net/mapping/rest/services';
const county='https://socogis.sonomacounty.ca.gov/map/rest/services';
const base=pet+'/Basemaps/COFP_BASEMAP_PUBLIC/MapServer';
const LIST=[
 {id:'hydrants',name:'Fire Hydrants',category:'Fire & EMS',special:true,terms:['fire hydrant','hydrant']},
 {id:'stations',name:'Fire Stations',category:'Fire & EMS',url:county+'/BASEPublic/Fire_Stations/FeatureServer/0',color:'#ff9b72',terms:['fire station','station locations']},
 {id:'firehazard',name:'Fire Hazard Zones',category:'Fire & EMS',url:pet+'/Planning/Development_Related/MapServer/2',color:'#f57d67',terms:['fire hazard','hazard zones']},
 {id:'wui',name:'Wildland Urban Interface',category:'Fire & EMS',url:pet+'/Fire/FireWebApp_MIL/MapServer/2',color:'#efb75a',terms:['wildland urban','wildland interface','wui']},
 {id:'evac',name:'Evacuation Zones',category:'Emergency Management',url:'https://services1.arcgis.com/P5Mv5GY5S66M8Z1Q/ArcGIS/rest/services/Sonoma_County_Evacuation_Areas_public/FeatureServer/0',color:'#f2c15b',terms:['evacuation zones','evacuation zone','evac zones']},
 {id:'flood',name:'Flood Zones',category:'Emergency Management',url:pet+'/Fire/FireWebApp_MIL/MapServer/28',color:'#59adff',terms:['flood zones','flood zone','floodplain']},
 {id:'beats',name:'Police Beats',category:'Law Enforcement',url:pet+'/EnerGov/EnerGov_Display/MapServer/10',color:'#74aaff',terms:['police beats','patrol beats','police districts']},
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
  const b=map.getBounds(),sw=b.getSouthWest(),ne=b.getNorthEast();const controller=new AbortController();pending.get(item.id)?.abort();pending.set(item.id,controller);
  const args=new URLSearchParams({where:'1=1',geometry:JSON.stringify({xmin:sw.lng,ymin:sw.lat,xmax:ne.lng,ymax:ne.lat,spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',spatialRel:'esriSpatialRelIntersects',inSR:'4326',outSR:'4326',outFields:'*',returnGeometry:'true',resultRecordCount:'500',f:'geojson'});
  try{const res=await fetch(item.url+'/query?'+args,{signal:controller.signal});if(!res.ok)throw Error(`GIS HTTP ${res.status}`);const data=await res.json();if(!active.has(item.id)||pending.get(item.id)!==controller)return;if(data.error)throw Error(data.error.message||'GIS query error');
   let group=layers.get(item.id);if(!group){group=L.layerGroup().addTo(map);layers.set(item.id,group)}group.clearLayers();
   if(data.type!=='FeatureCollection')throw Error('GeoJSON response unavailable');
   L.geoJSON(data,{style:{color:item.color,weight:2,fillColor:item.color,fillOpacity:.11,opacity:.8},pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{radius:5,color:item.color,weight:2,fillOpacity:.45,fillColor:item.color}),onEachFeature:(f,layer)=>layer.bindPopup(`<strong>${esc(item.name)}</strong><br>${fieldText(f.properties)}<br><small>Public GIS reference; verify before use.</small>`)}).addTo(group);
   if(data.features.length>=500)report(`${item.name}: showing up to 500 features. Zoom closer for more detail.`);
  }catch(e){if(e.name==='AbortError')return;layers.get(item.id)?.clearLayers();report(`${item.name} unavailable from its GIS provider: ${e.message}. Map unchanged.`)}
 }
 function refresh(){for(const item of LIST)if(active.has(item.id)&&!item.special&&!item.unavailable)void load(item)}
 map.on('moveend zoomend',refresh); // Data is viewport-scoped, never repositions map.
 function mount(host){if(!host)return;mountNode=host;const wrap=document.createElement('details');wrap.className='cad-gis-layers';wrap.innerHTML='<summary aria-label="Layers">Layers ▾</summary><div class="cad-gis-options"></div>';host.appendChild(wrap);
  let category='';const content=wrap.querySelector('.cad-gis-options');for(const item of LIST){if(item.category!==category){category=item.category;const h=document.createElement('strong');h.textContent=category;content.appendChild(h)}const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.dataset.layer=item.id;cb.disabled=!!item.unavailable;cb.checked=active.has(item.id);cb.onchange=()=>set(item.id,cb.checked);label.append(cb,document.createTextNode(' '+item.name+(item.unavailable?' (feed unavailable)':'')));content.appendChild(label)}
  wrap.addEventListener('pointerdown',e=>e.stopPropagation());refresh();
 }
 async function voice(raw){const text=String(raw||'').toLowerCase().replace(/[.,?!]/g,' ').replace(/\s+/g,' ');
  const isLayer=/\b(layer|layers|hydrants?|stations?|zones?|beats?|parcels?|buildings?|schools?|flood|fire hazard|wildland|evacuation|sheriff|road closures|traffic incidents|address points)\b/.test(text);
  if(!isLayer)return false;
  if(/\b(?:clear|reset|hide|remove|turn off)\s+(?:all\s+)?layers\b/.test(text)){for(const id of [...active])set(id,false,{quiet:true});report('All optional map layers hidden. Map center and zoom unchanged.');return true}
  const matches=LIST.filter(x=>x.terms.some(w=>new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(text)));
  if(!matches.length)return false;
  const hide=/\b(hide|remove|turn off|disable|clear)\b/.test(text);
  const only=/\b(only|just)\b/.test(text)&&!hide;
  if(only)for(const id of [...active])if(!matches.some(x=>x.id===id))set(id,false,{quiet:true});
  for(const match of matches)set(match.id,!hide,{quiet:true});
  report(`${hide?'Hidden':'Selected'}: ${matches.map(x=>x.name).join(', ')}. Map zoom and center preserved.`);return true;
 }
 return{mount,voice,set,refresh,items:LIST};
};
})();
