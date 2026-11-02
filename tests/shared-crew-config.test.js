const assert=require('node:assert/strict');
const crew=require('../core/shared-crew-config');
const units=['E1','T1','R1','BR1','WT1','M1'].map(x=>({id:x,agency_id:'a',call_sign:x}));
const groups=[{id:'c1',name:'Station 1 Shared Crew',agencyId:'a',unitIds:['E1','T1','R1','BR1','WT1']}];
assert.deepEqual(crew.validate(groups,units),[]);
for(const committed of groups[0].unitIds){
 const blocked=crew.blockedUnits(groups,[committed]);
 assert.equal(blocked.size,4);
 for(const other of groups[0].unitIds.filter(x=>x!==committed))assert.equal(blocked.get(other).committedBy[0],committed);
}
assert.deepEqual(crew.blockedUnits(groups,[]).size,0);
assert.ok(crew.validate([...groups,{id:'c2',name:'Other',agencyId:'a',unitIds:['T1','M1']}],units).some(x=>x.includes('multiple')));
assert.ok(crew.validate([{...groups[0],unitIds:['E1','missing']}],units).some(x=>x.includes('Unknown')));
assert.ok(crew.validate([{...groups[0],unitIds:['E1']}],units).some(x=>x.includes('at least two')));
console.log('Shared crew config scenarios PASS');
