const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const select={value:'Medical Aid',set innerHTML(html){this.options=html;this.value=html.match(/value="([^"]*)"/)?.[1]||'';}};
const ctx={window:{cadSharedLastSnapshot:{cfsTypes:[
 {discipline:'LAW',name:'Accident with Injuries',publication:'ACTIVE'},
 {discipline:'EMS',name:'Medical Aid',publication:'ACTIVE'},
 {discipline:'EMS',name:'Traumatic Injury',publication:'ACTIVE'},
 {discipline:'LAW',name:'Unpublished',publication:'DRAFT'}
]}},cadSharedWorkspaceMode:true,defaultConfig:{types:{LAW:['Old Law'],FIRE:['Old Fire']}},config:{types:{}},escapeCad:String,$:id=>id==='#discipline'?{value:'EMS'}:select};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('window.cadConfiguredTypes='),source.indexOf('window.cadFindEventsByLocation=')),ctx);
vm.runInContext(source.slice(source.indexOf('function updateTypes(){'),source.indexOf('/* Live CAD address suggestions')),ctx);
assert.deepEqual(Array.from(ctx.window.cadConfiguredTypes('LAW')),['Accident with Injuries']);
assert.deepEqual(Array.from(ctx.window.cadConfiguredTypes('FIRE')),[],'An agency catalog must not offer unconfigured legacy types');
ctx.updateTypes();
assert.equal(select.value,'Medical Aid','Catalog refresh preserves a still-valid selection');
assert(select.options.includes('Traumatic Injury'));
ctx.window.cadSharedLastSnapshot.cfsTypes=ctx.window.cadSharedLastSnapshot.cfsTypes.filter(x=>x.name!=='Medical Aid');
ctx.updateTypes();assert.equal(select.value,'Traumatic Injury','An inactive or removed choice cannot remain selected');
ctx.cadSharedWorkspaceMode=false;
assert.deepEqual(Array.from(ctx.window.cadConfiguredTypes('LAW')),['Old Law'],'Local workspace retains its own configuration');
console.log('PASS: shared call-taking picker uses active agency CFS catalog and preserves valid choices');
