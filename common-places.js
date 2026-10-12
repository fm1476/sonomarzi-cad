/* v19.9 browser-local agency Common Places directory and configuration navigation */
(()=>{'use strict';
const KEY='smcad-common-places-v19.9';let places=[];
try {places=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(places))places=[];}catch{places=[]}
const el=id=>document.getElementById(id);
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function names(place){return [place.name,...place.aliases].map(norm).filter(Boolean)}
function conciseAddress(value){const v=String(value||'').trim();const parts=v.split(',').map(x=>x.trim()).filter(Boolean);const ix=parts.findIndex((x,i)=>/^\d{1,6}$/.test(x)&&parts[i+1]);if(ix>=0)return [parts[ix]+' '+parts[ix+1],parts.find(x=>/^(Petaluma|California)$/i.test(x))||'Petaluma','CA'].filter((v,i,a)=>a.indexOf(v)===i).join(', ');return v;}
function matching(s){const query=norm(s);return places.filter(p=>names(p).includes(query))}
function resolve(s){const m=matching(s);if(m.length===1)return {...m[0],address:conciseAddress(m[0].address)};const a=norm(s);const byAddress=places.filter(p=>norm(p.address)===a);return byAddress.length===1?{...byAddress[0],address:conciseAddress(byAddress[0].address)}:null}
function replaceAliases(text){let str=String(text||'');const sorted=places.flatMap(p=>[p.name,...p.aliases].map(name=>({name,p}))).filter(x=>x.name.trim().length>1).sort((a,b)=>b.name.length-a.name.length);
 for(const x of sorted){const re=new RegExp('(^|[^a-z0-9])('+escapeRegex(x.name)+')(?=$|[^a-z0-9])','gi');str=str.replace(re,(_,prefix)=>prefix+conciseAddress(x.p.address))}return str}
function unique(name,aliases,except){const all=[name,...aliases].map(norm).filter(Boolean);if(all.length!==new Set(all).size)return false;return !places.some(p=>p.id!==except&&names(p).some(n=>all.includes(n)))}
function persist(){localStorage.setItem(KEY,JSON.stringify(places));render()}
const sections=el('cadConfigSection');sections?.addEventListener('change',()=>{document.querySelectorAll('[data-config-panel]').forEach(p=>p.hidden=p.dataset.configPanel!==sections.value)});sections?.dispatchEvent(new Event('change'));
let selected=null,editing=null;
function message(t){el('cadPlaceValidated').textContent=t}
function clear(){el('cadPlaceName').value='';el('cadPlaceAliases').value='';el('cadPlaceAddress').value='';el('cadPlaceResults').replaceChildren();el('cadPlaceSave').disabled=true;selected=null;editing=null;message('')}
async function validate(){selected=null;el('cadPlaceSave').disabled=true;el('cadPlaceResults').replaceChildren();const q=el('cadPlaceAddress').value.trim();if(!q)return message('Enter an address first.');message('Searching for matching addresses…');
 try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&q='+encodeURIComponent(q+', Petaluma, California'),{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Geocoding service unavailable');const found=await r.json();if(!found.length)return message('No locations found. Check the street address.');message('Select the correct location from the results below to confirm it.');
 for(const item of found){const b=document.createElement('button');b.type='button';b.className='cad-place-result';b.textContent=item.display_name;b.onclick=()=>{selected={address:conciseAddress(item.display_name),coordinates:[Number(item.lat),Number(item.lon)]};el('cadPlaceAddress').value=selected.address;el('cadPlaceSave').disabled=false;message('Selected validated map location. Review then Save Common Place.')};el('cadPlaceResults').append(b)}
 }catch(err){message('Address search failed: '+err.message)}}
function savePlace(){const name=el('cadPlaceName').value.trim(),aliases=el('cadPlaceAliases').value.split(/\n/).map(x=>x.trim()).filter(Boolean);
 if(!name||!selected)return message('A common name and a selected, validated location are required.');
 if(!unique(name,aliases,editing))return message('Duplicate or ambiguous name/alias. Every alias must uniquely identify a single place.');
 const record={id:editing||('place-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),name,aliases,...selected,verifiedAt:new Date().toISOString()};
 if(editing)places=places.map(x=>x.id===editing?record:x);else places.push(record);persist();clear();message('Common Place saved in this browser.');}
function render(){const host=el('cadPlaceList');if(!host)return;host.replaceChildren();for(const p of places){const row=document.createElement('div');row.className='cad-place-row';const title=document.createElement('div');title.textContent=p.name+' — '+p.address+(p.aliases.length?' | Aliases: '+p.aliases.join(', '):'');const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.onclick=()=>{editing=p.id;el('cadPlaceName').value=p.name;el('cadPlaceAliases').value=p.aliases.join('\n');el('cadPlaceAddress').value=p.address;selected={address:p.address,coordinates:p.coordinates};el('cadPlaceSave').disabled=false;message('Editing validated location; revalidate if the address changes.');};const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';remove.onclick=()=>{if(confirm('Delete common place '+p.name+'?')){places=places.filter(x=>x.id!==p.id);persist();clear()}};row.append(title,edit,remove);host.append(row)}}
el('cadPlaceValidate')?.addEventListener('click',validate);el('cadPlaceSave')?.addEventListener('click',savePlace);el('cadPlaceCancel')?.addEventListener('click',clear);el('cadPlaceAddress')?.addEventListener('input',()=>{selected=null;el('cadPlaceSave').disabled=true});render();
window.cadCommonPlaces={resolve,replaceAliases,conciseAddress,list:()=>places.slice()};
})();
