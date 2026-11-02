const assert=require('assert');
const mappings=require('../core/cfs-mappings');
const catalog=[
{id:'law-accident',discipline:'LAW',label:'Accident with Injuries',responsePlanId:'law-plan',autoCreate:['fire-mva','ems-trauma']},
{id:'fire-mva',discipline:'FIRE',label:'MVA with Injuries',responsePlanId:'fire-plan'},
{id:'ems-trauma',discipline:'EMS',label:'Traumatic Injury',responsePlanId:'ems-plan'}
];
const combined=mappings.plan(catalog,'law-accident');
assert.equal(combined.length,3);
assert.deepEqual(combined.map(x=>x.discipline),['LAW','FIRE','EMS']);
assert.deepEqual(combined.map(x=>x.type),['Accident with Injuries','MVA with Injuries','Traumatic Injury']);
assert.equal(combined[1].responsePlanId,'fire-plan');
assert.equal(mappings.plan(catalog,'fire-mva').length,1,'Mappings are directional');
assert.throws(()=>mappings.plan([...catalog,{id:'duplicate',discipline:'FIRE',label:'Other',autoCreate:['fire-mva']}],'duplicate'));
assert.throws(()=>mappings.plan(catalog,'unknown'));
console.log('PASS: CFS type-driven combined event creation and directional mappings');
