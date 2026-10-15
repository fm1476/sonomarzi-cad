const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {unitList,callsigns,classify}=require('../core/shared-voice-intents.js');
const voiceText=require('../core/voice-text.js');
const roster=['E1','E2','M2','3A14'].map(id=>({id}));
for(const [phrase,expected] of [
 ['engine one in route',['E1']],['Engine 1 on scene with a confirmed working structure fire requesting balance of assignment',['E1']],
 ['engine wanted coffee on scene with a confirmed working structure fire requesting balance of assignment',['E1']],
 ['Engine 2, Medic 2 respond structure fire 450 East Washington',['E2','M2']],
 ['3 out of 14 on scene',['3A14']]
]){
 assert.deepStrictEqual(unitList(phrase,roster,voiceText).map(u=>u.id),expected,phrase);
}
assert.equal(callsigns('engine one in route',roster,voiceText)?.id,'E1');
assert.equal(classify('engine one in route').status,'ENROUTE');
assert.deepStrictEqual(unitList('engine wanted coffee on a normal call',roster,voiceText),[],'never repair garbled ASR without specific confirmed fire context');
const voice=fs.readFileSync(path.join(__dirname,'..','voice.js'),'utf8');
const compound=voice.slice(voice.indexOf('async function processSharedVoiceCompound('),voice.indexOf('async function processSharedVoiceReclassification('));
assert(compound.includes('processSharedVoiceReclassification(first,intelligence)'));
assert(compound.includes('processSharedVoiceBatchDispatch(second)'));
assert(compound.indexOf('processSharedVoiceReclassification(first,intelligence)')<compound.indexOf('processSharedVoiceBatchDispatch(second)'));
assert(compound.includes('owned[0].sharedUuid!==target.sharedUuid'),'validate same existing call');
const batch=voice.slice(voice.indexOf('async function processSharedVoiceBatchDispatch('),voice.indexOf('async function processSharedVoiceCompound('));
assert(batch.includes("window.cadSharedCommand('batch-assign'"),'multiunit shared transaction');
assert(batch.includes("response?.incomplete"),'partial assignments must never report full success');
assert(!batch.includes('save()'));
const panel=fs.readFileSync(path.join(__dirname,'..','core/shared-demo-panel.js'),'utf8');
assert(panel.includes("client.assignResponsePlan("));
console.log('PASS: engine/medic names, compound break, status, cautious ASR and partial-dispatch safeguards');
