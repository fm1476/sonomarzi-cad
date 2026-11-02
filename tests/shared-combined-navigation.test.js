const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const ctx={window:{scrollY:0,scrollTo(){},addEventListener(){}},document:{getElementById(){return null}},state:{selected:'26-000001'},cadSharedWorkspaceMode:false,cadLocalWorkspace:null,render(){}};
vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('window.cadSharedApplySnapshot='),app.indexOf('window.cadSharedRestoreLocal=')),ctx);
vm.runInContext(app.slice(app.indexOf('function cadIncidentFamily('),app.indexOf('function toast(t)')),ctx);
ctx.escapeCad=String;
const snapshot={incidents:[
 {id:'law-uuid',incident_number:'26-000001',discipline:'LAW',status:'ACTIVE'},
 {id:'fire-uuid',incident_number:'26-000002',discipline:'FIRE',status:'PENDING'},
 {id:'ems-uuid',incident_number:'26-000003',discipline:'EMS',status:'CLOSED'},
 {id:'other-uuid',incident_number:'26-000004',discipline:'LAW',status:'PENDING'}
],combinedLinks:['law','fire','ems'].map(d=>({incident_id:d+'-uuid',root_incident_id:'law-uuid'}))};
ctx.window.cadSharedApplySnapshot(snapshot);
for(const incident of ctx.state.incidents.slice(0,3)){
 const family=ctx.state.incidents.filter(x=>ctx.cadIncidentFamily(x).id===ctx.cadIncidentFamily(incident).id);
 assert.equal(family.length,3,'All shared family members remain navigable, including closed calls');
 assert.deepEqual(Array.from(family,x=>x.id),['26-000001','26-000002','26-000003']);
 const html=ctx.cadLinkedNavigation(incident);
 assert(html.includes('data-linked-incident="26-000002"'));
 assert(!html.includes('law-uuid'),'Navigation uses visible incident numbers');
}
assert.equal(ctx.cadIncidentFamily(ctx.state.incidents[3]).id,'26-000004');
assert.equal(ctx.state.incidents[0].linkedFrom,null,'Root does not link to itself');
assert.equal(ctx.state.incidents[1].linkedFrom,'26-000001');
ctx.window.cadSharedApplySnapshot({...snapshot,combinedLinks:[]});
assert.equal(ctx.state.incidents[1].linkedRoot,null,'Refresh removes obsolete family links');
console.log('PASS: shared database family links produce navigable independent incident numbers');
