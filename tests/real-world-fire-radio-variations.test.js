const assert=require('node:assert/strict');
const intents=require('../core/shared-voice-intents.js');
const dictionary=require('../core/voice-text.js');
const units=['E1','E2','E3','B1'].map(id=>({id}));
const cases=[
 {heard:'Engine One I copy you on scene with a working structure fire, requesting balance of assignment. Engine Two, Engine Three, Battalion One, respond structure fire, 450 East Washington Street.',scene:true,working:true},
 {heard:'Engine One, I copy structure fire requesting balance of assignment, break. Engine Two, Engine Three, Battalion One, respond structure fire 450 East Washington Street.',scene:false,working:false}
];
for(const c of cases){
 const parsed=intents.parseWorkingFireTransmission(c.heard,units,dictionary);
 assert(parsed,'must recognize balance request');
 assert.equal(parsed.reporter?.id,'E1','reporter');
 assert.deepEqual(parsed.responders.map(x=>x.id),['E2','E3','B1'],'responding units');
 assert.equal(parsed.onScene,c.scene,'do not invent on-scene status');
 assert.equal(parsed.workingFire,c.working,'do not invent confirmed working fire');
 assert.match(parsed.order,/450 East Washington Street/);
 assert.equal(parsed.reason,null);
}
const missing=intents.parseWorkingFireTransmission(cases[1].heard,units.filter(x=>x.id!=='E1'),dictionary);
assert.equal(missing.reporter,null,'missing reporter must not be guessed');
assert.equal(intents.parseWorkingFireTransmission('Engine Two respond to the station',units,dictionary),null);
console.log('PASS real world radio reporting and responder extraction');