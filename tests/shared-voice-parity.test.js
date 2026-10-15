const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../voice.js'),'utf8');
const start=src.indexOf('function sharedSpokenUnit(');
const end=src.indexOf('process=function(',start);
assert.ok(start>=0&&end>start,'Shared voice handler must exist');
const actions=[];
const unit={id:'3A14',discipline:'LAW',status:'AVAILABLE'};
const inc={id:'26-004521',status:'PENDING',type:'Traffic Collision',location:'123 Main St',units:[]};
const ui={voiceHeard:{textContent:''},voiceInterpretation:{textContent:''},voiceSource:{value:'RADIO'}};
const context={
 state:{units:[unit],incidents:[inc],selected:inc.id},
 config:{types:{LAW:['Traffic Collision'],FIRE:['Structure Fire'],EMS:['Medical']}},
 window:{CadRadioStatusRepair:{repair:s=>s},cadSharedCommand:async(action,args)=>{actions.push({action,args});return {case_number:'26-C000001',incident_number:'26-004530'};},confirm:()=>true,prompt:()=> 'Report Taken'},
 normalize:s=>String(s).toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim(),
 nums:s=>s.replace(/\bone\b/g,'1').replace(/\bfourteen\b/g,'14'),
 el:id=>ui[id]||{textContent:''},
 activity:()=>{},renderActivity:()=>{},indicator:()=>{},
 unitMatches:s=>/3\s*adam\s*14|3014|3a14/i.test(s)?[unit]:[],
 contextUnits:(s,m)=>({units:m,resolution:m.length?'explicit':'none'}),
 parseStatus:s=>({status:/\brespond\b/i.test(s)?'DISPATCHED':null}),
 caseRequest:s=>/case\s+number/i.test(s),
 matchDispatchIncident:()=>({incident:inc,reason:'full address'}),
 association:()=>null,requestedDispo:()=>'',console
};
context.window.window=context.window;
vm.runInNewContext(src.slice(start,end)+'\nglobalThis.sharedVoice=processSharedRadio;',context);
(async()=>{
 await context.sharedVoice('logging on rescue one','RADIO');
 assert.equal(actions.pop().action,'registerUnit');
 await context.sharedVoice('3 Adam 14 respond traffic collision 123 Main Street','RADIO');
 assert.equal(actions.pop().action,'assign');
 inc.status='ACTIVE';inc.units=['3A14'];
 await context.sharedVoice('3 Adam 14 requesting case number','RADIO');
 assert.equal(actions.pop().action,'allocateCase');
 await context.sharedVoice('3 Adam 14 add note patient is conscious','RADIO');
 assert.equal(actions.pop().action,'note');
 await context.sharedVoice('3 Adam 14 update location to 456 Main Street','RADIO');
 assert.equal(actions.pop().action,'location');
 await context.sharedVoice('create incident traffic collision at 123 Main Street','RADIO');
 assert.equal(actions.pop().action,'create');
 await context.sharedVoice('3 Adam 14 logging off','RADIO');
 assert.equal(actions.pop().action,'rosterStatus');
 console.log('Shared voice parity integration checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
