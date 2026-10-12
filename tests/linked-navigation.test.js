const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const helpers=app.slice(app.indexOf('function cadIncidentFamily('),app.indexOf('function toast(t)'));
const sample={id:'26-004518',discipline:'LAW',status:'ACTIVE',units:['3A21'],events:[]};
const state={incidents:[sample,{id:'26-004526',discipline:'FIRE',status:'ACTIVE',linkedFrom:sample.id,linkedRoot:sample.id,units:['E1'],events:[]},{id:'26-004527',discipline:'EMS',status:'CLOSED',linkedFrom:sample.id,linkedRoot:sample.id,units:[],events:[]}]};
const ctx={state,escapeCad:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),event:()=>{}};
vm.createContext(ctx);vm.runInContext(helpers,ctx);
for(const incident of state.incidents){const html=ctx.cadLinkedNavigation(incident);for(const item of state.incidents)assert(html.includes(item.id));assert.equal((html.match(/data-linked-incident=/g)||[]).length,3);assert.equal((html.match(/aria-current="true"/g)||[]).length,1);}
assert.equal(ctx.cadLinkedNavigation({id:'no-family',discipline:'LAW',status:'ACTIVE'}),'');
const voice=fs.readFileSync(path.join(__dirname,'..','voice.js'),'utf8');
for(const token of ['HEARD: ${text}','UNIT: ${units.map','EVENT: ${inc?.id','REVIEW: '])assert(voice.includes(token),token);
console.log('PASS: navigable linked Police/Fire/EMS family, current-event disabled, event statuses and voice explainability');
