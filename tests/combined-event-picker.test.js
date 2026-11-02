const assert=require('assert');
const {validate}=require('../combined-event-picker');
const types={LAW:['Accident','Traffic Hazard'],FIRE:['MVA Injuries'],EMS:['Traumatic Injury']};
assert.deepEqual(validate([{discipline:'LAW',type:'Accident'},{discipline:'FIRE',type:'MVA Injuries'}],types),[{discipline:'LAW',type:'Accident'},{discipline:'FIRE',type:'MVA Injuries'}]);
assert.throws(()=>validate([],types));
assert.throws(()=>validate([{discipline:'LAW',type:'MVA Injuries'}],types));
assert.throws(()=>validate([{discipline:'LAW',type:'Accident'},{discipline:'LAW',type:'Accident'}],types));
console.log('PASS: discipline-specific call type selector validation');
