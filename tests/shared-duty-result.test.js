const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../core/shared-demo-panel.js'),'utf8');
let refreshed=0;
const ctx={window:{CadDemoLogin:{current:()=>({agencyId:'agency'}),client:()=>({setUnitDuty:async()=>({ok:true})})}},snapshot:{roster:[{id:'unit',call_sign:'QA1',status:'AVAILABLE',version:1}],assignments:[]},refresh:async()=>{refreshed++}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('window.cadSharedSetUnitDuty='),source.indexOf('window.cadSharedApplyCustomStatus=')),ctx);
(async()=>{
 const result=await ctx.window.cadSharedSetUnitDuty('QA1',false);
 assert.equal(result.ok,true,'Successful duty RPC must return without referencing unrelated command variables');
 assert.equal(refreshed,1);
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const start=app.indexOf('${cadSharedWorkspaceMode?');
 const expression=app.slice(start+2,app.indexOf('}</div>',start));
 for(const held of [false,true]){
  const html=vm.runInNewContext(expression,{cadSharedWorkspaceMode:true,i:{sharedHold:held,status:'PENDING'}});
  assert(html.includes('>'+ (held?'Release Hold':'Hold for Unit') +'</button>'));
  assert(!html.includes('${i.sharedHold'));
 }
 console.log('PASS: shared duty results and rendered hold labels');
})().catch(error=>{console.error(error);process.exitCode=1});
