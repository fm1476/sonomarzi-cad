/* Optional five-dispatcher CAD demo login.
 * Supabase Auth owns passwords and issues signed access tokens.
 * No privileged keys, passwords, or persistent JWT storage in source.
 */
(()=>{'use strict';
 const allowed=new Set(['cad1','cad2','cad3','cad4','cad5']);
 let session=null;
 let api=null;
 function configure({url,publishableKey,agencyId}){
  if(!/^https:\/\/[a-z0-9.-]+$/i.test(url||''))throw Error('HTTPS Supabase URL required');
  if(!publishableKey||!agencyId)throw Error('CAD demo configuration incomplete');
  api={url:url.replace(/\/$/,''),key:publishableKey,agencyId};
 }
 async function login(username,password){
  const user=String(username||'').trim().toLowerCase();
  if(!allowed.has(user))throw Error('Select cad1 through cad5');
  if(!api)throw Error('CAD demo backend has not been configured');
  if(typeof password!=='string'||!password)throw Error('Password required');
  // Internal demo email alias. Accounts must be created in Supabase Auth first.
  const email=user+'@cad-demo.invalid';
  const response=await fetch(api.url+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:api.key,'Content-Type':'application/json'},
   body:JSON.stringify({email,password}),cache:'no-store'
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.access_token)throw Error('CAD login failed. Verify the account and password.');
  session={username:user,accessToken:data.access_token,expiresAt:Date.now()+Math.max(0,(Number(data.expires_in)||0)-30)*1000};
  return {username:user,agencyId:api.agencyId};
 }
 function logout(){session=null}
 function current(){return session&&Date.now()<session.expiresAt?{username:session.username,agencyId:api.agencyId}:null}
 function client(){
  if(!current())throw Error('CAD login required or session expired');
  return window.CadSupabase.create({url:api.url,anonKey:api.key,getAccessToken:()=>current()?session.accessToken:null});
 }
 window.CadDemoLogin=Object.freeze({configure,login,logout,current,client,accounts:[...allowed].sort()});
})();
