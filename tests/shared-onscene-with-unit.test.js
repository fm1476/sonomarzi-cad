const assert=require('node:assert/strict');
const voice=require('../core/shared-voice-intents.js');
const text=require('../core/voice-text.js');
const units=['3A11','3A12','3A14'].map(id=>({id,sharedUuid:'test-'+id}));
for(const phrase of [
 '3a12 onscene with 3a11',
 '3Adam12 on scene with 3Adam11',
 'Three Adam Twelve on scene with Three Adam Eleven'
]){
 const result=voice.reportingStatus(phrase,units,text);
 assert(result,phrase);
 assert.equal(result.status,'ONSCENE',phrase);
 assert.equal(result.reporter?.id,'3A12',phrase);
 assert.deepEqual(result.companions.map(u=>u.id),['3A11'],phrase);
 assert.equal(result.reason,null);
 assert.equal(result.companionMentioned,true);
}
const single=voice.reportingStatus('3a12 on scene',units,text);
assert.equal(single.reporter?.id,'3A12');
assert.deepEqual(single.companions,[]);
const bad=voice.reportingStatus('3a12 on scene with 3a99',units,text);
assert.equal(bad.reporter?.id,'3A12');
assert.equal(bad.companionMentioned,true);
assert.equal(bad.companions.length,0,'never invent unrecognized accompaniment');
assert.equal(voice.reportingStatus('3a12 enroute with 3a11',units,text),null);
const code=require('node:fs').readFileSync('voice.js','utf8');
assert(code.includes('report?report.reporter:intents?.callsigns'),'reporting unit overrides generic multiple-unit ambiguity');
assert(code.includes('accompanying unit status unchanged'),'second unit is contextual only');
assert(code.includes('Accompanying unit not identified'),'ambiguous accompaniment blocks write');
console.log('PASS: on-scene reporting unit and accompanying unit roles remain separate');
