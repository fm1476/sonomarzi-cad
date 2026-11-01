const assert=require('node:assert/strict');
const intents=require('../core/shared-voice-intents.js');
const voiceText=require('../core/voice-text.js');
const roster=['3A11','3A12','3A14'].map(id=>({id}));
for(const phrase of ['3adam12 with 3a11','Three Adam Twelve with Three Adam Eleven','3A12 with 3A11']){
 const result=intents.unitAccompaniment(phrase,roster,voiceText);
 assert(result,phrase);
 assert.equal(result.reporter?.id,'3A12',phrase);
 assert.deepEqual(result.companions.map(x=>x.id),['3A11'],phrase);
 assert.equal(result.status,null,'must not infer ON SCENE');
 assert.equal(result.reason,null,phrase);
 assert.equal(intents.classify(phrase).kind,'REVIEW','status classifier must not claim arrival');
}
const missing=intents.unitAccompaniment('3adam12 with 3a99',roster,voiceText);
assert.equal(missing.reporter?.id,'3A12');
assert(missing.reason,'unknown unit requires review');
assert.equal(intents.unitAccompaniment('3adam12 on scene',roster,voiceText),null);
const src=require('node:fs').readFileSync('voice.js','utf8');
assert(src.includes('window.CadSharedVoiceIntents?.unitAccompaniment('));
assert(src.includes('STATUS: Not stated'));
assert(src.includes('No status, incident assignment or shared records changed.'));
console.log('PASS: status-free 3Adam12 with 3A11 identifies companionship without changing CAD');
