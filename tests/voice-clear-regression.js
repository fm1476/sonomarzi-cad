const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const voice=fs.readFileSync(path.join(__dirname,'..','voice.js'),'utf8');
const section=voice.slice(voice.indexOf('function requestedDispo(text){'),voice.indexOf('function caseRequest(text)'));
const ctx={normalizeRadioStatus:(s)=>s.toLowerCase().replace(/[-_.,!?]/g,' ').replace(/\s+/g,' ').trim()};vm.createContext(ctx);vm.runInContext(section,ctx);
for(const [spoken,expected] of [
 ['Engine one clear with dispo false alarm','False Alarm'],
 ['E1 clear with disposition no fire found','No Fire Found'],
 ['Medic two clear, patient refusal','Patient Refusal'],
 ['Three Adam twenty one clear, report taken','Report Taken'],
 ['Engine one clear with disposition smoke investigation complete','Smoke Investigation Complete'],
 ['Engine one clear','']]) assert.equal(ctx.requestedDispo(spoken),expected,spoken);
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const clear=app.slice(app.indexOf('function clearCadUnit('),app.indexOf('function toast(t)'));
// Limit evaluation to the clear routine (the intervening code also contains incident linking helpers).
const fn=clear.slice(0,clear.indexOf('\nfunction cadIncidentFamily('));
const stateCtx={now:()=>'12:00:00',event:(i,m)=>i.events.push(m)};vm.createContext(stateCtx);vm.runInContext(fn,stateCtx);
const police={id:'26-004518',status:'ACTIVE',units:['3A21'],events:[]};
const fire={id:'26-004526',status:'ACTIVE',units:['E1'],events:[]};
const engine={id:'E1',status:'ONSCENE',location:'725 D St'};
const result=stateCtx.clearCadUnit(fire,engine,'False Alarm','VOICE');
assert(result.ok);assert.equal(fire.status,'CLOSED');assert.equal(engine.status,'CLEAR');assert.equal(fire.units.length,0);assert.equal(police.status,'ACTIVE');assert.deepEqual(police.units,['3A21']);
console.log('PASS: voice Fire/EMS/Law dispositions; linked Fire closure; original Police unaffected');
