const assert=require('node:assert/strict');
const fs=require('node:fs');
const bridge=require('../core/cfs-catalog-bridge');
const law='11111111-1111-4111-8111-111111111111';
const fire='22222222-2222-4222-8222-222222222222';
const original=[{id:'law-draft',discipline:'LAW',name:'Accident with Injuries',code:'TAI',publication:'Draft'}];
(async()=>{
 let writes=[];
 const api={loadCfsCatalog:async()=>[{id:law,discipline:'LAW',code:'TAI'}],saveCfsType:async x=>writes.push(x)};
 await assert.rejects(bridge.saveCatalog({api,agency:'agency',catalog:original,makeId:()=>law}),error=>{
  assert.match(error.message,/Load Agency Call Types/);assert.equal(error.writesStarted,false);return true;
 });
 assert.equal(writes.length,0,'Conflict must be detected before any partial save');
 assert.equal(original[0].id,'law-draft','Failed publication must preserve draft IDs');
 await assert.rejects(bridge.saveCatalog({api,agency:'agency',catalog:[{...original[0],code:' tai '}],makeId:()=>law}),/already saved/);
 // The same saved record can be edited, rather than being treated as a duplicate.
 await bridge.saveCatalog({api,agency:'agency',catalog:[{...original[0],id:law,publication:'Active'}]});
 assert.equal(writes.length,1);
 writes=[];
 const newTypes=[{...original[0],code:'NEW',publication:'Active',fire:'fire-draft',fireEnabled:true},{id:'fire-draft',discipline:'FIRE',name:'Rescue',code:'RES',publication:'Active'}];
 let next=0;
 const saved=await bridge.saveCatalog({api,agency:'agency',catalog:newTypes,makeId:()=>[law,fire][next++]});
 assert.equal(saved[0].fire,fire,'New draft references must map to allocated UUIDs');
 assert.deepEqual(writes[2].cfsType.autoCreate,[fire]);
 assert.equal(newTypes[0].id,'law-draft','Successful save returns a copy instead of mutating caller state');
 writes=[];
 await assert.rejects(bridge.saveCatalog({api,agency:'agency',catalog:[{...newTypes[0],id:law,fire:'missing'}],makeId:()=>law}),/Invalid FIRE/);
 assert.equal(writes.length,0,'Invalid linked type must fail before any writes');
 const racing={loadCfsCatalog:async()=>[],saveCfsType:async()=>{throw Error('CAD request failed (409): duplicate key violates unique constraint')}};
 await assert.rejects(bridge.saveCatalog({api:racing,agency:'agency',catalog:[{...original[0],id:law}]}),error=>{
  assert(!error.message.includes('constraint'));assert(!error.message.includes('409'));assert.equal(error.writesStarted,true);return true;
 });
 const html=fs.readFileSync(require.resolve('../prototypes/cfs-type-designer.html'),'utf8');
 assert.match(html,/catalog=loaded;current=catalog\[0\];returnTo=null;localStorage.setItem\(STORE,JSON.stringify\(catalog\)\)/,'Loading agency types must persist their IDs for the next designer visit');
 console.log('PASS: CFS draft conflicts prevent partial writes, preserve drafts, and provide clear recovery');
})().catch(error=>{console.error(error);process.exitCode=1});
