/* Browser-local agency master records. Separate from resettable CAD demo state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadAgencyMaster=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KEY='smcad-agency-master-v1',DISCIPLINES=['LAW','FIRE','EMS'],MODELS=['FIXED','PERSONNEL','APPARATUS','HYBRID'];
function clean(s){return String(s??'').trim();}
function validate(data){
 if(!data||!Array.isArray(data.agencies)||!Array.isArray(data.personnel)||!Array.isArray(data.units))throw Error('Expected agencies, personnel, and units arrays.');
 const agencies=new Set(),people=new Set(),units=new Set(),designators=new Set();
 for(const a of data.agencies){if(!a||!clean(a.id)||!clean(a.name)||!MODELS.includes(a.model))throw Error('Agency needs ID, name and identification model.');if(agencies.has(a.id))throw Error('Duplicate agency ID: '+a.id);agencies.add(a.id);}
 for(const p of data.personnel){if(!p||!clean(p.id)||!clean(p.name)||!agencies.has(p.agencyId))throw Error('Personnel must have ID, name and valid agency.');if(people.has(p.id))throw Error('Duplicate personnel ID: '+p.id);people.add(p.id);}
 for(const u of data.units){
  if(!u||!clean(u.id)||!clean(u.designator)||!agencies.has(u.agencyId)||!DISCIPLINES.includes(u.discipline)||!MODELS.includes(u.model))throw Error('Unit requires ID, designator, agency, discipline and model.');
  if(units.has(u.id))throw Error('Duplicate unit ID: '+u.id);units.add(u.id);
  const key=u.agencyId+'|'+u.designator.toUpperCase();if(designators.has(key))throw Error('Duplicate designator within agency: '+u.designator);designators.add(key);
  if(u.personId&&!people.has(u.personId))throw Error('Unknown personnel ID: '+u.personId);
  if(u.personId&&data.personnel.find(p=>p.id===u.personId).agencyId!==u.agencyId)throw Error('Unit personnel belongs to another agency.');
 }
 return true;
}
function empty(){return {version:1,agencies:[],personnel:[],units:[]};}
function parse(text){const data=JSON.parse(text);validate(data);return data;}
function read(storage){const raw=storage.getItem(KEY);return raw?parse(raw):empty();}
function save(storage,data){validate(data);storage.setItem(KEY,JSON.stringify(data));}
return Object.freeze({KEY,DISCIPLINES,MODELS,empty,parse,validate,read,save});
});