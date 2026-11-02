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
assert.deepEqual(r.unitIds,['u3']);
assert.ok(r.rows[0].excluded.some(x=>x.unit==='E2'&&x.reason.includes('Personnel')));
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
test('missing station assignment blocks a station-specific candidate',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1'],stationId:'station1'}]};
 const r=engine.recommend({plan:p,incident,roster});
 assert.equal(r.status,'shortage');
 assert.ok(r.rows[0].excluded.some(x=>x.unit==='E1'&&x.reason.includes('Station assignment not verified')));
});
test('invalid or empty requirements fail closed',()=>{
 const r=engine.recommend({plan:{...plan,resources:[{type:'ENGINE',count:0}]},incident,roster});
 assert.equal(r.status,'blocked');
 assert.deepEqual(r.unitIds,[]);
 assert.equal(engine.recommend({plan:{...plan,resources:[]},incident,roster}).status,'blocked');
});
test('mutual aid cannot be inferred from external agency units',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1']}]};
 const r=engine.recommend({plan:p,incident,roster:[{...roster[0],agency_id:'another-agency'}]});
 assert.equal(r.status,'shortage');
 assert.ok(r.rows[0].excluded.some(x=>x.reason.includes('mutual aid')));
});
test('alarm escalation subtracts resources already assigned',()=>{
 const p={...plan,alarmLevels:[{id:'first',name:'First Alarm',rank:1,mode:'TOTAL',resources:[{type:'ENGINE',count:1,preferredUnits:['E1','E2','E3']}]},{id:'second',name:'Second Alarm',rank:2,mode:'TOTAL',resources:[{type:'ENGINE',count:2,preferredUnits:['E1','E2','E3']}]}]};
 const r=engine.escalate({plan:p,incident:{...incident,alarm_level:'First Alarm'},level:'second',roster,assignments:[{incident_id:'i1',unit_id:'u1'}]});
 assert.equal(r.status,'ready');assert.equal(r.rows[0].alreadyAssigned,1);assert.deepEqual(r.unitIds,['u3']);
});
test('alarm levels do not permit repeated same-level escalation',()=>{
 const p={...plan,alarmLevels:[{id:'first',name:'First Alarm',rank:1,resources:[{type:'ENGINE',count:1}]}]};
 assert.equal(engine.escalate({plan:p,incident:{...incident,alarm_level:'First Alarm'},level:'first',roster}).status,'blocked');
});
test('additive escalation includes crossed tiers, without duplicate assigned units',()=>{
 const p={...plan,alarmLevels:[{id:'first',name:'First Alarm',rank:1,mode:'ADDITIVE',resources:[{type:'ENGINE',count:1,preferredUnits:['E1','E2','E3']}]},{id:'second',name:'Second Alarm',rank:2,mode:'ADDITIVE',resources:[{type:'ENGINE',count:1,preferredUnits:['E1','E2','E3']}]}]};
 const r=engine.escalate({plan:p,incident:{...incident,alarm_level:'First Alarm'},level:'second',roster,assignments:[{incident_id:'i1',unit_id:'u1'}]});
 assert.deepEqual(r.unitIds,['u3']);
});
test('canonical plan works with legacy incident lacking CFS ID only when name matches',()=>{const p={...plan,cfsTypeId:'type-123'};assert.equal(engine.match(p,incident),true);assert.equal(engine.match(p,{...incident,type:'Medical Aid'}),false);assert.equal(engine.match(p,{...incident,cfs_type_id:'different'}),false);});
test('additive escalation starts from the latest total target without summing earlier totals',()=>{
 const req=count=>({type:'ENGINE',count,preferredUnits:['E1','E2','E3']});
 const p={...plan,alarmLevels:[{id:'first',rank:1,mode:'TOTAL',resources:[req(1)]},{id:'second',rank:2,mode:'TOTAL',resources:[req(2)]},{id:'third',rank:3,mode:'ADDITIVE',resources:[req(1)]}]};
 const r=engine.escalate({plan:p,incident,level:'third',roster});
 assert.equal(r.rows[0].requested,3);
 assert.equal(r.rows[0].shortage,1);
});
test('explicit draft or mismatched response plan cannot recommend units',()=>{
 assert.equal(engine.recommend({plan:{...plan,status:'DRAFT'},incident,roster}).status,'blocked');
 assert.equal(engine.recommend({plan:{...plan,discipline:'EMS'},incident,roster}).status,'blocked');
});
test('duplicate resource requirement rows fail closed rather than double counting',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1']},{type:'ENGINE',count:2,preferredUnits:['E2','E3']}]};
 const result=engine.recommend({plan:p,incident,roster,assignments:[{incident_id:incident.id,unit_id:'u1'}]});
 assert.equal(result.status,'blocked');assert.deepEqual(result.unitIds,[]);
});
test('resource quantities over 99 fail closed',()=>{
 const result=engine.recommend({plan:{...plan,resources:[{type:'ENGINE',count:100,preferredUnits:['E1']}]},incident,roster});
 assert.equal(result.status,'blocked');assert.deepEqual(result.unitIds,[]);
});
test('shared crew links by stable unit UUID prevent duplicate response',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:2,preferredUnits:['E1','E2','E3']}]};
 const result=engine.recommend({plan:p,incident,roster:roster.map(u=>({...u,staffing:undefined})),crews:[{id:'crew-uuid',unitIds:['u1','u2']}]});
 assert.deepEqual(result.unitIds,['u1','u3']);
});
test('assigned shared crew partner excludes other apparatus even when UUID referenced',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:2,preferredUnits:['E1','E2','E3']}]};
 const result=engine.recommend({plan:p,incident,roster:roster.map(u=>({...u,staffing:undefined})),crews:[{id:'crew-uuid',unitIds:['u1','u2']}],assignments:[{incident_id:incident.id,unit_id:'u1'}]});
 assert.deepEqual(result.unitIds,['u3']);
});
test('station-specific response requires active station record',()=>{const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1'],stationId:'s1'}]};const r=engine.recommend({plan:p,incident,roster:[{...roster[0],station_id:'s1'}],stations:[{id:'s1',active:false,name:'Station 1'}]});assert.equal(r.status,'shortage');assert.ok(r.rows[0].excluded.some(x=>x.reason.includes('inactive')));});
test('station-specific response accepts configured active home station',()=>{const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1'],stationId:'s1'}]};const r=engine.recommend({plan:p,incident,roster:[{...roster[0],station_id:'s1'}],stations:[{id:'s1',active:true,name:'Station 1'}]});assert.deepEqual(r.unitIds,['u1']);});
test('duplicate personnel do not satisfy a two-person staffing requirement',()=>{const p={...plan,resources:[{type:'ENGINE',count:1,preferredUnits:['E1'],requiredStaffing:2}]};const r=engine.recommend({plan:p,incident,roster:[{...roster[0],staffing:{active:true,personIds:['p1','p1']}}]});assert.equal(r.status,'shortage');assert.ok(r.rows[0].excluded.some(x=>x.reason.includes('Insufficient staffing')));});
test('conflicting already-assigned shared apparatus block escalation recommendations',()=>{
 const p={...plan,resources:[{type:'ENGINE',count:3,preferredUnits:['E1','E2','E3']}]};
 const result=engine.recommend({plan:p,incident,roster:roster.map(u=>({...u,staffing:undefined})),crews:[{id:'shared',unitIds:['u1','u2']}],assignments:[{incident_id:'i1',unit_id:'u1'},{incident_id:'i1',unit_id:'u2'}]});
 assert.equal(result.status,'blocked');assert.deepEqual(result.unitIds,[]);assert.ok(result.warnings.some(x=>x.includes('Conflicting shared crew')));
});
console.log('Response engine regression checks passed.');
