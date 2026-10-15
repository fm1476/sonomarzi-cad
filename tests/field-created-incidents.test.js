const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const state={seq:4525,incidents:[],units:[{id:'3A21',status:'AVAILABLE',discipline:'LAW',agency:'Petaluma Police'}]};
const config={types:{LAW:['Traffic Stop','Suspicious Vehicle'],FIRE:['Fire Alarm'],EMS:['Medical Aid']}};
const elements={voiceHeard:{},voiceInterpretation:{}};
const ctx={state,config,window:{CadVoiceText:require('../core/voice-text.js')},document:{getElementById:id=>elements[id]},save(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','voice-incident-creation.js'),'utf8'),ctx);
let accepted=ctx.window.cadBeforeVoiceProcess('3A21 Traffic Stop 123 Main St blue toyoate 4-runner CA 2wnp196','FIELD');
assert.strictEqual(accepted,true);assert.strictEqual(state.incidents.length,1);
const i=state.incidents[0];assert.strictEqual(i.type,'Traffic Stop');assert.strictEqual(i.location,'123 Main St');assert.strictEqual(i.plate,'2WNP196');assert.strictEqual(i.vehicle,'blue Toyota 4Runner');assert.strictEqual(i.units[0],'3A21');assert.strictEqual(i.status,'ACTIVE');assert.strictEqual(state.units[0].status,'ONSCENE');
ctx.window.cadBeforeVoiceProcess('3A21 Traffic Stop 123 Main St blue toyoate 4-runner CA 2wnp196','FIELD');assert.strictEqual(state.incidents.length,1);
assert.strictEqual(ctx.window.cadConfiguredVoiceType.identifyType('suspicious vehicle').type,'Suspicious Vehicle');
state.units[0].status='AVAILABLE';ctx.window.cadBeforeVoiceProcess('3A21 Traffic Stop unknown location','FIELD');assert.strictEqual(state.incidents.length,1);
// Real-world radio transcription, including natural phrasing and phonetic license plate.
state.units.push({id:'3A12',status:'AVAILABLE',discipline:'LAW',agency:'Petaluma Police'});
const actual='3A12 is on a traffic stop, 1562 Henry Way, Blue Toyota 4Runner, California 2 William Nora Paul 196.';
assert.strictEqual(ctx.window.cadBeforeVoiceProcess(actual,'RADIO_TX'),true);
assert.strictEqual(state.incidents.length,2);
assert.strictEqual(state.incidents[1].location,'1562 Henry Way');
assert.strictEqual(state.incidents[1].plate,'2WNP196');
assert.strictEqual(state.incidents[1].vehicle,'Blue Toyota 4Runner');
assert.strictEqual(state.units[1].status,'ONSCENE');
state.units.push({id:'3A13',status:'AVAILABLE',discipline:'LAW',agency:'Petaluma Police'});
const natural="Three Adam Thirteen's on a traffic stop. Fifteen sixty-two Henry Way, blue Toyota 4Runner, California 2 William Nora Paul 196";
assert.strictEqual(ctx.window.cadBeforeVoiceProcess(natural,'FIELD'),true);
assert.strictEqual(state.incidents.length,3);
assert.strictEqual(state.incidents[2].location,'1562 Henry Way');
assert.strictEqual(state.incidents[2].units[0],'3A13');
assert.strictEqual(state.incidents[2].plate,'2WNP196');
// Exact screenshot phrase with unit twelve and spelled street number.
state.incidents[1].status='CLOSED';state.incidents[1].units=[];state.units[1].status='AVAILABLE';
const screenshot="Three Adam Twelve's on a traffic stop. Fifteen sixty-two Henry Way, blue Toyota 4Runner, California 2 William Nora Paul 196";
assert.strictEqual(ctx.window.cadBeforeVoiceProcess(screenshot,'FIELD'),true);
assert.strictEqual(state.incidents.length,4);
assert.strictEqual(state.incidents[3].units[0],'3A12');
assert.strictEqual(state.incidents[3].location,'1562 Henry Way');
assert.strictEqual(state.incidents[3].plate,'2WNP196');
// Exact screenshot from v18.8: punctuation immediately following a compact spoken callsign.
state.units.push({id:'3A14',status:'AVAILABLE',discipline:'LAW',agency:'Petaluma Police'});
const compactScreenshot='3Adam14, traffic stop, 1562 Henry Way, blue Toyota 4Runner, California 2 William Nora Paul 196.';
assert.strictEqual(ctx.window.cadBeforeVoiceProcess(compactScreenshot,'FIELD'),true);
assert.strictEqual(state.incidents.length,5,'comma after compact callsign must create the event');
assert.strictEqual(state.incidents[4].units[0],'3A14');
assert.strictEqual(state.incidents[4].location,'1562 Henry Way');
assert.strictEqual(state.incidents[4].plate,'2WNP196');
assert.strictEqual(state.units.at(-1).status,'ONSCENE');
console.log('PASS: field-initiated stop, unit and plate extraction, status, duplicate protection, custom type lookup, invalid address');

// Production screenshot: speech-to-text pluralized the spoken unit number.
state.incidents[4].status='CLOSED';state.incidents[4].units=[];state.units[3].status='AVAILABLE';
const pluralTranscript='Three Adam Fourteens on a traffic stop, 1562 Henry Way, blue Toyota 4Runner, California 2 William Nora Paul 196.';
assert.strictEqual(ctx.window.cadBeforeVoiceProcess(pluralTranscript,'FIELD'),true);
assert.strictEqual(state.incidents.length,6,'pluralized callsign should create an incident');
assert.strictEqual(state.incidents[5].units[0],'3A14');
assert.strictEqual(state.incidents[5].plate,'2WNP196');
assert.strictEqual(state.units[3].status,'ONSCENE');
