const assert=require('node:assert/strict');
const bridge=require('../core/cfs-catalog-bridge');
const law='11111111-1111-4111-8111-111111111111',fire='22222222-2222-4222-8222-222222222222',ems='33333333-3333-4333-8333-333333333333';
const catalog=[
{id:law,discipline:'LAW',name:'Accident with Injuries',code:'TAI',priority:'Priority 2',publication:'Active',fire,fireEnabled:true,ems,emsEnabled:true},
{id:fire,discipline:'FIRE',name:'MVA with Injuries',code:'MVA-I',priority:'Priority 1',publication:'Active'},
{id:ems,discipline:'EMS',name:'Traumatic Injury',code:'TRAUMA',priority:'Priority 1',publication:'Active'}
];
const mapped=bridge.toCloud(catalog[0],catalog);
assert.deepEqual(mapped.autoCreate,[fire,ems]);
assert.equal(mapped.priority,'P2');
assert.equal(mapped.publication,'ACTIVE');
const roundtrip=bridge.fromCloud([{...mapped},{...bridge.toCloud(catalog[1],catalog)},{...bridge.toCloud(catalog[2],catalog)}]);
assert.equal(roundtrip[0].fire,fire);
assert.equal(roundtrip[0].ems,ems);
assert.equal(roundtrip[0].priority,'Priority 2');
assert.deepEqual(bridge.toCloud(catalog[1],catalog).autoCreate,[],'Mappings are directional');
assert.throws(()=>bridge.toCloud({...catalog[0],id:'draft-1'},catalog),/database UUID/);
assert.throws(()=>bridge.toCloud(catalog[0],[catalog[0],{...catalog[1],publication:'Draft'},catalog[2]]),/Activate linked FIRE/);
assert.throws(()=>bridge.toCloud({...catalog[0],fire:ems},catalog),/Invalid FIRE/);
console.log('PASS: CFS catalog cloud mapping and publication guards');
