const assert=require('node:assert/strict');
const engine=require('../core/response-engine');
const incident={id:'i1',agency_id:'a1',discipline:'FIRE',type:'Structure Fire',priority:1,response_zone:'ESZ-1'};
const plan={id:'p1',status:'ACTIVE',agencyId:'a1',discipline:'FIRE',type:'Structure Fire',priority:1,area:'ESZ-1',resources:[{type:'ENGINE',count:2,preferredUnits:['E1','E2','E3']}]};
const roster=[
{id:'u1',call_sign:'E1',discipline:'FIRE',resource_type:'ENGINE',status:'AVAILABLE',staffing:{active:true,personIds:['p1','p2']}},
{id:'u2',call_sign:'E2',discipline:'FIRE',resource_type:'ENGINE',status:'AVAILABLE',staffing:{active:true,personIds:['p1','p2']}},
{id:'u3',call_sign:'E3',discipline:'FIRE',resource_type:'ENGINE',status:'AVAILABLE',staffing:{active:true,personIds:['p3','p4']}}
];
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name);throw e}}
test('matches agency, discipline, priority, and response area',()=>{
assert.equal(engine.match(plan,incident),true);
assert.equal(engine.match(plan,{...incident,discipline:'LAW'}),false);
assert.equal(engine.match(plan,{...incident,response_zone:'ESZ-9'}),false);
assert.equal(engine.match(plan,{...incident,priority:3}),false);
});
test('rejects ambiguous equally specific plans',()=>{
assert.equal(engine.selectPlan([plan,{...plan,id:'p2'}],incident).plan,null);
});
test('prevents personnel double counting',()=>{
const r=engine.recommend({plan,incident,roster});
assert.deepEqual(r.unitIds,['u1','u3']);
assert.ok(r.rows[0].excluded.some(x=>x.unit==='E2'&&x.reason.includes('Personnel')));
});
test('prevents shared crew double counting',()=>{
const r=engine.recommend({plan,incident,roster:roster.map(u=>({...u,staffing:undefined})),crews:[{id:'crew1',units:['E1','E2']}]});
assert.deepEqual(r.unitIds,['u1','u3']);
assert.ok(r.rows[0].excluded.some(x=>x.unit==='E2'&&x.reason.includes('Shared crew')));
});
test('does not recommend busy units or silently preempt',()=>{
const r=engine.recommend({plan,incident,roster,assignments:[{incident_id:'other',unit_id:'u1'}]});
assert.deepEqual(r.unitIds,['u2','u3']);
assert.ok(r.rows[0].excluded.some(x=>x.unit==='E1'&&x.reason.includes('another incident')));
});
test('already assigned resources reduce unmet quantities',()=>{
const r=engine.recommend({plan,incident,roster,assignments:[{incident_id:'i1',unit_id:'u1'}]});
assert.equal(r.rows[0].alreadyAssigned,1);
assert.deepEqual(r.unitIds,['u3']);
assert.equal(r.rows[0].shortage,0);
});
test('unverified qualifications cause shortages',()=>{
const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1'],qualifications:['PARAMEDIC']}]};
const r=engine.recommend({plan:p,incident,roster});
assert.equal(r.status,'shortage');assert.equal(r.rows[0].shortage,1);
assert.ok(r.rows[0].excluded.some(x=>x.reason.includes('qualification')));
});
test('missing configured run order does not invent nearest resource',()=>{
const p={...plan,resources:[{type:'ENGINE',count:1}]};
const r=engine.recommend({plan:p,incident,roster});
assert.equal(r.unitIds.length,0);
assert.equal(r.status,'shortage');
});
console.log('Response engine regression checks passed.');
