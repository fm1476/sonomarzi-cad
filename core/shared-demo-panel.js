/* Optional read-only shared CAD board; local demo stays independent. */
(()=>{'use strict';
 function boot(){
  const root=document.getElementById('cadSharedDemo');
  if(!root||!window.CadDemoLogin)return;
  const $=id=>root.querySelector('#'+id);
  const status=$('cadSharedStatus');
  const say=message=>{status.textContent=message};
  const form=$('cadSharedLoginForm');
  const board=$('cadSharedBoard');
  const loginPanel=$('cadSharedLoginPanel');
  const tbody=$('cadSharedIncidents');
  const units=$('cadSharedUnits');
  const shortages=$('cadSharedShortages');
  const counts=$('cadSharedCounts');
  const text=(node,value)=>{node.textContent=String(value??'—')};
  function cell(row,value){const td=document.createElement('td');text(td,value);row.appendChild(td)}
  function displayRows(host,items,fields){
   host.replaceChildren();
   for(const item of items){const tr=document.createElement('tr');for(const field of fields)cell(tr,item[field]);host.appendChild(tr)}
  }
  async function refresh(){
   if(!window.CadDemoLogin.current()){say('Sign in to load shared data.');return}
   const client=window.CadDemoLogin.client();
   const agency=window.CadDemoLogin.current().agencyId;
   say('Refreshing shared CAD data…');
   try{
    const [incidents,roster,missing]=await Promise.all([
     client.listIncidents(agency),client.listUnits(agency),client.listOutstanding(agency)
    ]);
    displayRows(tbody,incidents,['incident_number','status','discipline','created_at']);
    displayRows(units,roster,['call_sign','status','resource_type']);
    displayRows(shortages,missing,['incident_id','resource_type','missing_count']);
    text(counts,incidents.length+' incidents · '+roster.length+' units · '+missing.length+' resource shortages');
    say('Shared CAD snapshot loaded. Read-only preview; local demo actions are not synchronized.');
   }catch(error){say(error.message)}
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const submit=$('cadSharedSignIn');submit.disabled=true;
   try{
    window.CadDemoLogin.configure({
     url:$('cadSharedUrl').value.trim(),publishableKey:$('cadSharedKey').value.trim(),agencyId:$('cadSharedAgency').value.trim()
    });
    const result=await window.CadDemoLogin.login($('cadSharedUser').value,$('cadSharedPassword').value);
    $('cadSharedPassword').value='';
    loginPanel.hidden=true;board.hidden=false;
    text($('cadSharedSignedIn'),result.username);
    await refresh();
   }catch(error){say(error.message)}finally{submit.disabled=false}
  });
  $('cadSharedRefresh').addEventListener('click',refresh);
  $('cadSharedLogout').addEventListener('click',()=>{
   window.CadDemoLogin.logout();
   tbody.replaceChildren();units.replaceChildren();shortages.replaceChildren();
   board.hidden=true;loginPanel.hidden=false;
   say('Signed out of shared CAD. Local demo remains available.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
