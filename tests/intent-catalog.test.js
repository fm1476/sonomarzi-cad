const assert=require('node:assert/strict');
const catalog=require('../core/intent-catalog.js');
const {evaluate}=require('../core/command-gate.js');
const {plan}=require('../core/action-plan.js');
assert.deepEqual(Object.keys(catalog.catalog).sort(),[...catalog.ids].sort());
for(const intent of catalog.ids){
 const entry=catalog.catalog[intent];
 assert.ok(entry.label&&entry.permission&&entry.kind);
 assert.equal(typeof entry.confirmation,'boolean');
 const context=Object.fromEntries(entry.required.map(key=>[key,'TEST-1']));
 const result=evaluate({status:'matched',intent},context);
 assert.equal(result.status,'recognized',intent);
 const action=plan(result,context,[entry.permission]);
 assert.equal(action.intent,intent);
 assert.equal(action.permission,entry.permission);
 assert.equal(action.executionAllowed,false);
 assert.equal(action.status,entry.confirmation?'needs_confirmation':'planned');
}
console.log('Shared CAD intent catalog remains aligned with gate and planner.');
