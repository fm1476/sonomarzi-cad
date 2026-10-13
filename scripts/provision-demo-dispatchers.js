/* Run locally only. NEVER commit service-role keys or passwords.
 * SUPABASE_SERVICE_ROLE_KEY=... CAD_PASSWORD_1=... ... CAD_PASSWORD_5=... node scripts/provision-demo-dispatchers.js
 * Requires Node 22+. Creates five confirmed demo Auth users and scoped dispatcher memberships.
 */
'use strict';
const base='https://gtmdigvuwjyfpgpdjmph.supabase.co';
const agency='ec800f31-c030-438f-9d8f-51c70a75af95';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const passwords=Array.from({length:5},(_,i)=>process.env['CAD_PASSWORD_'+(i+1)]);
if(!key||passwords.some(p=>!p||p.length<12)||new Set(passwords).size!==5){
 console.error('Provide SUPABASE_SERVICE_ROLE_KEY and five distinct CAD_PASSWORD_1 through CAD_PASSWORD_5 values, each at least 12 characters.');process.exit(1);
}
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error('Supabase provisioning failed ('+response.status+'): '+(data?.message||data?.msg||data?.error||'Unknown error'));
 return data;
}
async function existingUsers(){
 const users=[];
 for(let page=1;page<=30;page++){
  const data=await api('/auth/v1/admin/users?page='+page+'&per_page=100');
  users.push(...(data.users||[]));
  if((data.users||[]).length<100)break;
  if(page===30)throw Error('Too many auth users to scan safely');
 }
 return users;
}
(async()=>{
 const known=await existingUsers();
 for(let i=1;i<=5;i++){
  const email='cad'+i+'@cad-demo.invalid';
  let user=known.find(u=>u.email?.toLowerCase()===email);
  if(!user){
   user=await api('/auth/v1/admin/users','POST',{email,password:passwords[i-1],email_confirm:true,app_metadata:{cad_demo:true}});
   console.log('Created cad'+i);
  }else{
   // Do not reset existing credentials silently.
   console.log('Found cad'+i+' (password unchanged)');
  }
  if(!user?.id)throw Error('No auth user ID returned for cad'+i);
  await api('/rest/v1/cad_memberships?on_conflict=agency_id,user_id','POST',{agency_id:agency,user_id:user.id,role:'DISPATCHER'});
  console.log('Linked cad'+i+' to demo agency');
 }
 console.log('Five CAD demo dispatcher memberships provisioned.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
