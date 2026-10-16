/* CAD cloud settings sync. No incident data, credentials or tokens are synchronized.
 * Initial migration is opt-in with backup; subsequent writes use optimistic versions.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadCloudSettings=api;
})(typeof window!=='undefined'?window:null,function(root){
 'use strict';
 const AGENCY_KEYS=new Set([
  'smcad-agency-master-v1','smcad-resource-types-v1','smcad-config-v1',
  'smcad-response-plans-v1','smcad-shared-crews-v1',
  'smcad-facilities-v1','smcad-station-moveups-v1','smcad-alarm-levels-v1',
  'smcad-common-places-v19.9','smcad-gis-overlays-v20.8',
  'smcad-officer-safety-rules-v1','smcad-agency-phrase-preview-v1'
 ]);
 const USER_KEYS=new Set([
  'smcad-board-layout-v15.5','smcad-unit-column-widths-v1','smcad-panel-order-v15.5',
  'smcad-panel-lanes-v16.8','smcad-freeform-v16.9',
  'smcad-workspace-presets-v16.5','smcad-workspace-current-v16.5',
  'smcad-command-placement-v16.3','smcad-command-floating-rect-v16.3',
  'smcad-board-heights-v16.5','smcad-workspace-popouts-v16.6',
  'smcad-active-popouts-v16.8','smcad-map-display-v19.3',
  'smcad-voice-order-v17.3','smcad-dispatcher-identity-v1',
  'smcad-calltake-split-v1','smcad-calltake-panel-heights-v2'
 ]);
 const keyScope=key=>AGENCY_KEYS.has(key)||/^smcad-form-designer-v1-[a-z0-9_.%+-]+$/i.test(key)?'AGENCY':USER_KEYS.has(key)||/^smcad-(?:map-view|map-layers|display|theme|layout)-[a-z0-9.-]+$/i.test(key)?'USER':null;
 const rowsToMap=(agencies,preferences)=>{
  const m=new Map();
  for(const item of agencies||[])m.set('AGENCY:'+item.document_key,{scope:'AGENCY',key:item.document_key,version:Number(item.version),raw:item.payload?.raw});
  for(const item of preferences||[])m.set('USER:'+item.preference_key,{scope:'USER',key:item.preference_key,version:Number(item.version),raw:item.payload?.raw});
  return m;
 };
 const scan=storage=>{
  const output=new Map();
  for(let i=0;i<storage.length;i++){
   const key=storage.key(i),scope=keyScope(key);
   if(scope){const raw=storage.getItem(key);if(raw!==null)output.set(scope+':'+key,{scope,key,raw});}
  }
  return output;
 };
 if(!root)return Object.freeze({keyScope,scan,rowsToMap,AGENCY_KEYS,USER_KEYS});
 let session=null,versions=new Map(),baseline=new Map(),busy=false,timer=null,enabled=false;
 const el=id=>document.getElementById(id);
 const syncKey=()=>session?'smcad-cloud-sync-approved-v1:'+session.agencyId+':'+session.username:'';
 const shadowKey=()=>syncKey()+':last-local-snapshot';
 function shadow(){try{return new Map(JSON.parse(localStorage.getItem(shadowKey())||'[]'));}catch{return new Map();}}
 const report=msg=>{const out=el('cadCloudStatus');if(out)out.textContent=msg;};
 async function remote(client,agency){
  const [agencyRows,userRows]=await Promise.all([client.listAgencySettings(agency),client.listMyPreferences(agency)]);
  return rowsToMap(agencyRows,userRows);
 }
 function backup(){
  const values={};
  for(let i=0;i<localStorage.length;i++){
   const k=localStorage.key(i);if(keyScope(k))values[k]=localStorage.getItem(k);
  }
  const data={format:'sonomarzi-cad-cloud-migration-backup-v1',timestamp:new Date().toISOString(),origin:location.origin,values};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='cad-cloud-migration-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return Object.keys(values).length;
 }
 function remember(remoteRows){
  versions=remoteRows;
  baseline=scan(localStorage);
  try{localStorage.setItem(shadowKey(),JSON.stringify([...baseline].map(([id,item])=>[id,item.raw])));}catch(error){report('Sync snapshot could not be stored: '+error.message);}
 }
 function stop(){if(timer)clearInterval(timer);timer=null;enabled=false;session=null;versions=new Map();baseline=new Map();report('Connect to shared CAD to synchronize settings.');}
 async function upload(){
  if(!session||busy)throw Error('Sign in first.');
  busy=true;
  try{
   const client=root.CadDemoLogin.client(),agency=session.agencyId;
   const existing=await remote(client,agency),local=scan(localStorage);
   const changed=[...local].filter(([id,item])=>existing.get(id)?.raw!==item.raw);
   if(!changed.length){remember(existing);return {uploaded:0};}
   // Upload is first-write only unless an explicit follow-up workflow resolves conflicts.
   if(changed.some(([id])=>existing.has(id)))throw Error('Cloud already has different settings. Download and review cloud settings first; no records were overwritten.');
   const count=backup();
   if(!confirm('A local backup download has started ('+count+' keys). After saving it, upload '+changed.length+' settings to shared CAD? Existing cloud settings are protected.'))return {cancelled:true};
   let uploaded=0;
   for(const [id,item] of changed){
    const result=await client.saveCloudSetting({agency,scope:item.scope,key:item.key,payload:{raw:item.raw},expectedVersion:0});
    existing.set(id,{...item,version:Number(result.version)});uploaded++;
   }
   remember(existing);
   localStorage.setItem(syncKey(),'1');enabled=true;startTimer();
   return {uploaded};
  }finally{busy=false;}
 }
 async function download(){
  if(!session||busy)throw Error('Sign in first.');
  busy=true;
  try{
   const client=root.CadDemoLogin.client(),existing=await remote(client,session.agencyId);
   if(!existing.size)throw Error('There are no cloud settings to download yet. Upload from the computer where you configured CAD first.');
   const count=backup();
   if(!confirm('A backup of '+count+' local settings has started. Apply '+existing.size+' cloud settings to this browser? Differences will be replaced and you must reload to apply them.'))return {cancelled:true};
   let changed=0;
   for(const row of existing.values()){
    if(typeof row.raw!=='string')continue;
    if(localStorage.getItem(row.key)!==row.raw){localStorage.setItem(row.key,row.raw);changed++;}
   }
   localStorage.setItem(syncKey(),'1');enabled=true;remember(existing);startTimer();
   return {downloaded:changed};
  }finally{busy=false;}
 }
 async function tick(){
  if(!enabled||!session||busy||!root.CadDemoLogin?.current()){return;}
  busy=true;
  try{
   const client=root.CadDemoLogin.client(),fresh=await remote(client,session.agencyId),now=scan(localStorage);
   // Never overwrite unsaved local changes with a remote update.
   for(const [id,row] of fresh){
    const last=versions.get(id),local=now.get(id);
    if(last&&last.version!==row.version&&local?.raw!==baseline.get(id)?.raw){
     enabled=false;report('Cloud conflict on '+row.key+'. Sync paused. Back up local settings and choose which copy to keep.');return;
    }
   }
   let incoming=0;
   for(const [id,row] of fresh){
    const last=versions.get(id),local=now.get(id);
    if(typeof row.raw!=='string')continue;
    if((!last||row.version!==last.version)&&local?.raw===baseline.get(id)?.raw){
     if(localStorage.getItem(row.key)!==row.raw){localStorage.setItem(row.key,row.raw);incoming++;}
    }
   }
   const current=scan(localStorage);
   let uploaded=0;
   for(const [id,item] of current){
    const cloud=fresh.get(id),previous=baseline.get(id);
    if(previous?.raw===item.raw)continue;
    if(cloud&&(!versions.has(id)||cloud.version!==versions.get(id).version)){enabled=false;report('Cloud changed while you edited '+item.key+'. Sync paused to protect both copies.');return;}
    try{
     const result=await client.saveCloudSetting({agency:session.agencyId,scope:item.scope,key:item.key,payload:{raw:item.raw},expectedVersion:cloud?.version||0});
     fresh.set(id,{...item,version:Number(result.version)});uploaded++;
    }catch(error){
     enabled=false;report('Cloud save was rejected for '+item.key+': '+error.message+'. Local data preserved.');return;
    }
   }
   remember(fresh);
   if(incoming)report(incoming+' cloud settings received. Reload the page to apply all layout/configuration changes; you will need to sign in again.');
   else if(uploaded)report('Saved '+uploaded+' updated settings to Supabase.');
  }catch(error){report('Cloud sync paused: '+error.message);enabled=false;}
  finally{busy=false;}
 }
 function startTimer(){if(timer)clearInterval(timer);timer=setInterval(()=>{void tick()},15000);}
 async function connect(){
  const current=root.CadDemoLogin?.current();
  if(!current)return;
  session={username:current.username,agencyId:current.agencyId};
  try{
   const existing=await remote(root.CadDemoLogin.client(),current.agencyId);
   if(localStorage.getItem(syncKey())==='1'){
    const prior=shadow();let applied=0,conflicts=[],offline=new Map();
    for(const [id,row] of existing){
     if(typeof row.raw!=='string')continue;
     const local=localStorage.getItem(row.key);
     if(local===row.raw)continue;
     if(prior.has(id)&&local===prior.get(id)){
      localStorage.setItem(row.key,row.raw);applied++;
     }else if(prior.has(id)&&row.raw===prior.get(id)){
      offline.set(id,prior.get(id)); // Local edit since last confirmed sync.
     }else conflicts.push(row.key);
    }
    if(conflicts.length){
     enabled=false;report('Cloud settings differ from unsynced local values ('+conflicts.join(', ')+'). Auto-sync held to protect your work. Back up and review the cloud download.');return;
    }
    remember(existing);
    for(const [id,raw] of offline){
     const item=baseline.get(id);if(item)baseline.set(id,{...item,raw});
    }
    if(offline.size){
     // Preserve the last synchronized snapshot until offline edits are uploaded.
     const syncShadow=shadow();for(const [id,raw] of offline)syncShadow.set(id,raw);
     try{localStorage.setItem(shadowKey(),JSON.stringify([...syncShadow]));}catch{}
    }
    enabled=true;startTimer();
    report(offline.size?offline.size+' offline edits ready to synchronize.':applied?applied+' settings loaded from Supabase. Reload the page to apply updated layout/configuration, then sign in again.':'Cloud sync enabled: '+existing.size+' saved settings. Changes will sync across devices.');
   }else{
    remember(existing);
    report('Cloud settings found: '+existing.size+'. On your original computer, upload first; on another computer, download.');
   }
  }catch(error){report('Unable to load cloud settings: '+error.message);}
 }
 function install(){
  const node=el('cadCloudSettings');if(!node)return;
  node.innerHTML='<strong>Cloud configuration & personal preferences</strong><p>Move your browser-only agency configuration and individual workspace layouts into Supabase. Always start on the computer holding your complete configuration. An automatic local backup is generated before import.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="cadCloudUpload" type="button">Back up & Upload This Browser</button><button id="cadCloudDownload" type="button">Back up & Use Cloud Settings</button><button id="cadCloudCheck" type="button">Check Sync Now</button></div><p id="cadCloudStatus" role="status">Sign in to shared CAD to begin.</p>';
  el('cadCloudUpload').onclick=async()=>{try{const r=await upload();report(r.cancelled?'Upload canceled.':r.uploaded+' new settings uploaded. Cloud sync is enabled.')}catch(e){report('Upload blocked: '+e.message)}};
  el('cadCloudDownload').onclick=async()=>{try{const r=await download();report(r.cancelled?'Download canceled.':r.downloaded+' settings applied locally. Reload to use them and sign in again.')}catch(e){report('Download blocked: '+e.message)}};
  el('cadCloudCheck').onclick=()=>void tick();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 return Object.freeze({keyScope,scan,rowsToMap,connect,stop,tick,AGENCY_KEYS,USER_KEYS});
});