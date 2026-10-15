const assert=require('node:assert/strict');
const {intent,resolve,canonical}=require('../core/unit-duty-intents.js');
const defs=[{id:'rescue',designator:'R1',discipline:'FIRE'},{id:'patrol',designator:'3A14',discipline:'LAW'},{id:'engine',designator:'E2',discipline:'FIRE'}];
for(const [radio,id] of [
 ['logging on rescue one','rescue'],
 ['Rescue One logging on','rescue'],
 ['log on duty R1','rescue'],
 ['3 Adam 14 logging on','patrol'],
 ['three adam fourteen logging on','patrol'],
 ['Engine Two logging on','engine'],
 ['Log on Engine 2','engine']
])assert.equal(resolve(radio,defs).unit?.id,id,radio);
for(const radio of ['rescue one respond to 450 Washington','cancel rescue one logging on','rescue one logging off','three adam fourteen on scene'])
 assert.equal(resolve(radio,defs).kind,'NONE',radio);
assert.equal(resolve('logging on rescue nine',defs).kind,'REVIEW');
assert.equal(canonical('Rescue One'),'r1');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const settings=fs.readFileSync('agency-master-settings.js','utf8');
const voice=fs.readFileSync('voice.js','utf8');
const client=fs.readFileSync('core/supabase-client.js','utf8');
const panel=fs.readFileSync('core/shared-demo-panel.js','utf8');
assert(html.includes('id="cadDutyLogOnSelect"'));
assert(html.includes('id="cadDutyLogOnButton"'));
assert(html.includes('core/unit-duty-intents.js'));
assert(settings.includes('window.cadLogOnConfiguredUnit=logOnDuty'));
assert(settings.includes("window.cadSharedRegisterMasterUnit(def,agency.name)"));
assert(voice.includes('window.CadUnitDutyIntents?.resolve(text'));
assert(voice.indexOf('window.CadUnitDutyIntents?.resolve(text')<voice.indexOf('if(window.cadSharedIsActive?.()){',voice.indexOf('process=function(text')),'logon must precede shared incident commands');
assert(client.includes("rpc('cad_register_unit'"));
assert(panel.includes('window.cadSharedRegisterMasterUnit=async function'));
assert(panel.includes("now.status!=='AVAILABLE'"),'confirm available in shared roster');
console.log('PASS new configured units log on manually and by voice into local/shared CAD');
