const assert=require('node:assert/strict'),fs=require('node:fs');
const intents=require('../core/shared-voice-intents.js');
const voiceText=require('../core/voice-text.js');
const roster=[
 {id:'3A12',sharedUuid:'joining-12',discipline:'LAW',status:'AVAILABLE'},
 {id:'3A11',sharedUuid:'reference-11',discipline:'LAW',status:'ONSCENE'}
];
const incident={id:'26-004512',sharedUuid:'active-incident',status:'ACTIVE',discipline:'LAW',units:['3A11']};
for(const utterance of ['3adam12 with 3a11','Three Adam Twelve with Three Adam Eleven','3A12 on scene with 3A11']){
 const plan=intents.planJoinUnitOnScene(utterance,roster,[incident],voiceText);
 assert.equal(plan?.kind,'JOIN_ON_SCENE',utterance);
 assert.equal(plan.joining.id,'3A12');
 assert.equal(plan.reference.id,'3A11');
 assert.equal(plan.incident.id,incident.id);
 assert.equal(plan.status,'ONSCENE');
}
for(const [name,rs,is,match] of [
 ['reference not assigned',roster,[],/exactly one active/],
 ['joining unit dispatched',[{...roster[0],status:'DISPATCHED'},roster[1]],[incident],/not available/],
 ['joining unit already on another call',roster,[incident,{...incident,id:'26-004513',sharedUuid:'other',units:['3A12']}],/already has/],
 ['cross-discipline',[{...roster[0],discipline:'FIRE'},roster[1]],[incident],/Cross-discipline/],
 ['ambiguous reference',roster,[incident,{...incident,id:'26-004513',sharedUuid:'other',units:['3A11']}],/exactly one active/]
]){
 const plan=intents.planJoinUnitOnScene('3adam12 with 3a11',rs,is,voiceText);
 assert.equal(plan.kind,'REVIEW',name);
 assert.match(plan.reason,match,name);
}
const panel=fs.readFileSync('core/shared-demo-panel.js','utf8');
const voice=fs.readFileSync('voice.js','utf8');
const client=fs.readFileSync('core/supabase-client.js','utf8');
const migration=fs.readFileSync('migrations/20261101_cad_join_unit_on_scene.sql','utf8');
assert(panel.includes("action==='join-onscene'"));
assert(client.includes("rpc('cad_join_unit_on_scene'"));
assert(voice.includes("window.cadSharedCommand('join-onscene'"));
assert(migration.includes("status='ONSCENE',version=version+1"));
assert(migration.includes("cad_has_access(p_agency,true)"));
assert(migration.includes("p_expected_incident_version"));
assert(migration.includes("p_expected_reference_version"));
assert(migration.includes("p_expected_joining_version"));
assert(migration.includes("UNIT_JOINED_ONSCENE"));
console.log('PASS: 3A12 joins 3A11 active call on scene atomically, with ambiguous cases blocked');
