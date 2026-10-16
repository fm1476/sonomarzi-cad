const assert=require('node:assert/strict'),fs=require('node:fs');
const c=require('../core/cloud-settings.js');
const A='AGENCY',U='USER',N=null;
for(const [key,scope] of [
 ['smcad-agency-master-v1',A],['smcad-resource-types-v1',A],['smcad-config-v1',A],
 ['smcad-response-plans-v1',A],['smcad-shared-crews-v1',A],['smcad-facilities-v1',A],
 ['smcad-station-moveups-v1',A],['smcad-alarm-levels-v1',A],
 ['smcad-common-places-v19.9',A],['smcad-gis-overlays-v20.8',A],
 ['smcad-form-designer-v1-AG-PETPD',A],['smcad-officer-safety-rules-v1',A],
 ['smcad-board-layout-v15.5',U],['smcad-panel-order-v15.5',U],
 ['smcad-panel-lanes-v16.8',U],['smcad-workspace-presets-v16.5',U],
 ['smcad-unit-column-widths-v1',U],['smcad-map-display-v19.3',U],
 ['smcad-calltake-split-v1',U],['smcad-calltake-panel-heights-v2',U],
 ['smcad-voice-order-v17.3',U],['smcad-freeform-v16.9',U],
 ['smcad-dispatcher-identity-v1',U],['smcad-workspace-popouts-v16.6',U],
 ['smcad-poc-v1',N],['smcad-officer-safety-v1',N],['smcad-geocode-v14',N],
 ['smcad-cloud-sync-approved-v1',N],['smcad-demo-snapshot',N],
 ['sb-local-auth-token',N],['supabase.auth.token',N],['smcad-voice-transcript-v1',N],
 ])assert.equal(c.keyScope(key),scope,key);
const pairs=[['smcad-board-layout-v15.5','{"x":1}'],['smcad-poc-v1','SECRET']];
const store={length:pairs.length,key:i=>pairs[i][0],getItem:k=>pairs.find(x=>x[0]===k)?.[1]||null};
const local=c.scan(store);
assert.equal(local.size,1);
assert.equal(local.get('USER:smcad-board-layout-v15.5').raw,'{"x":1}');
const remote=c.rowsToMap([{document_key:'smcad-agency-master-v1',payload:{raw:'{"agencies":[]}'},version:3}],
 [{preference_key:'smcad-board-layout-v15.5',payload:{raw:'{"x":2}'},version:9}]);
assert.equal(remote.get('AGENCY:smcad-agency-master-v1').version,3);
assert.equal(remote.get('USER:smcad-board-layout-v15.5').raw,'{"x":2}');
const html=fs.readFileSync('index.html','utf8'),panel=fs.readFileSync('core/shared-demo-panel.js','utf8'),client=fs.readFileSync('core/supabase-client.js','utf8');
assert(html.includes('id="cadCloudSettings"'));
assert(html.includes('core/cloud-settings.js'));
assert(panel.includes('await window.CadCloudSettings?.connect()'));
assert(panel.includes('window.CadCloudSettings?.stop()'));
assert(client.includes('listAgencySettings:agency=>'));
assert(client.includes('listMyPreferences:agency=>'));
assert(client.includes("rpc('cad_save_cloud_setting'"));
const sql=fs.readFileSync('migrations/20261015_cloud_settings.sql','utf8');
assert(sql.includes('enable row level security'));
assert(sql.includes('user_id=(select auth.uid())'));
assert(sql.includes('CAD settings version conflict'));
assert(sql.includes("p_expected_version is distinct from v_version"));
assert(sql.includes("case when p_scope='USER' then v_uid::text else '' end"),'agency CAS must serialize across all users');
const cloud=fs.readFileSync('core/cloud-settings.js','utf8');
assert(cloud.includes('Back up & Upload This Browser'));
assert(cloud.includes('Back up & Use Cloud Settings'));
assert(cloud.includes('const prior=shadow()'),'do not overwrite offline changes');
assert(!cloud.includes('smcad-poc-v1\',\'smcad-officer-safety-v1'),'exclude operational state');
console.log('PASS: cloud settings scope, privacy, database isolation, backup and conflict checks');
