/* Local-only demo save point, restore, and rollback of one voice/dispatcher action. */
(()=>{
const KEY='smcad-poc-v1',CFG='smcad-config-v1';
const SNAP='smcad-v14-demo-snapshot';
let undo=null;
const $=id=>document.getElementById(id);
const say=s=>{$('demoToolStatus').textContent=s;};
const clone=o=>JSON.parse(JSON.stringify(o));
function capture(label){undo={label,state:clone(state),savedAt:new Date().toLocaleTimeString()};$('undoCadAction').disabled=false;}
function reverseLast(requireRadio=false){
 if(!undo || (requireRadio && undo.label!=='radio transmission'))return false;
 const old=undo;const next=clone(old.state);
 // Append correction audit entries to affected incidents instead of pretending nothing happened.
 for(const inc of next.incidents){const previous=state.incidents.find(i=>i.id===inc.id);if(previous&&JSON.stringify({units:inc.units,status:inc.status,caseNumber:inc.caseNumber})!==JSON.stringify({units:previous.units,status:previous.status,caseNumber:previous.caseNumber})){inc.events ||= [];inc.events.push(new Date().toLocaleTimeString('en-US',{hour12:false})+' RADIO_CORRECTION Reversed last '+old.label);}}
 state=next;undo=null;$('undoCadAction').disabled=true;save();return true;
}
// Take a pre-transmission snapshot, not a snapshot after the state was changed.
window.cadBeforeVoiceProcess=function(text,source){
 const t=String(text||'').toLowerCase();
 if(/\b(?:disregard|scratch|cancel|undo|correction)\b/.test(t)&&/\b(?:last|previous|status|that)\b/.test(t)){
  const success=reverseLast(true);$('voiceHeard').textContent=text;$('voiceInterpretation').textContent=success?'Previous voice CAD action reversed; correction logged.':'REVIEW: No recent voice CAD action available to reverse.';say(success?'Voice correction applied.':'No voice change to reverse; no CAD data modified.');return true;
 }
 capture('radio transmission');return false;
};
// Capture before manual control changes, including an incident closure.
$('operationsPanel').addEventListener('click',e=>{
 const b=e.target.closest('button');if(b&&['opsAssign','opsApplyStatus','opsRelease','opsAutoCase','opsSaveCase'].includes(b.id))capture('dispatcher action');
},true);
$('detail').addEventListener('click',e=>{
 if(e.target.closest('[data-act]'))capture('incident action');
},true);
$('undoCadAction').onclick=()=>{
 if(!undo)return;
 if(!confirm('Undo last '+undo.label+'? This restores the CAD state recorded immediately before that action. AI summaries returned afterward might also be reverted.'))return;
 reverseLast();say('Previous CAD action reversed.');
};
$('saveDemoPoint').onclick=()=>{
 try{localStorage.setItem(SNAP,JSON.stringify({state:clone(state),config:clone(config),savedAt:new Date().toISOString()}));say('Demo restore point saved in this browser.');}
 catch(e){say('Unable to save restore point: '+e.message);}
};
$('restoreDemoPoint').onclick=()=>{
 const raw=localStorage.getItem(SNAP);if(!raw){say('No saved demo restore point. Save one first.');return;}
 if(!confirm('Restore the saved demo scenario? Current incident and radio activity will be replaced.'))return;
 try{
  const s=JSON.parse(raw);if(!s.state||!Array.isArray(s.state.incidents)||!Array.isArray(s.state.units))throw Error('Invalid saved scenario');
  state=s.state;config=s.config||config;localStorage.setItem(CFG,JSON.stringify(config));undo=null;$('undoCadAction').disabled=true;populate();save();say('Scenario restored from '+new Date(s.savedAt).toLocaleString()+'.');
 }catch(e){say('Restore failed: '+e.message);}
};
$('exportDemoPoint').onclick=()=>{
 const payload={version:14,exportedAt:new Date().toISOString(),state:clone(state),config:clone(config)};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='cad-demo-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Scenario exported to JSON.');
};
$('importDemoPoint').onchange=async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  const data=JSON.parse(await file.text());if(!data.state||!Array.isArray(data.state.incidents)||!Array.isArray(data.state.units))throw Error('Invalid scenario file');
  if(!confirm('Replace current browser CAD data with the imported scenario?'))return;
  state=data.state;config=data.config||config;localStorage.setItem(CFG,JSON.stringify(config));undo=null;$('undoCadAction').disabled=true;populate();save();say('Scenario imported.');
 }catch(err){say('Import failed: '+err.message)}
};
})();
