const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const requests=[];
const ctx={window:{CadSupabase:{create:args=>args}},Date,fetch:async(url,opts)=>{
 requests.push({url,opts});
 return {ok:true,json:async()=>({access_token:'test-token',expires_in:3600})};
}};
vm.runInNewContext(fs.readFileSync('core/demo-login.js','utf8'),ctx);
const login=ctx.window.CadDemoLogin;
assert.equal(login.accounts.length,5);
assert.throws(()=>login.configure({url:'http://bad.test',publishableKey:'pub',agencyId:'agency'}),/HTTPS/);
login.configure({url:'https://demo.supabase.co',publishableKey:'publishable',agencyId:'agency'});
(async()=>{
 await assert.rejects(login.login('cad6','password'),/cad1 through cad5/);
 await login.login('cad2','demo-password');
 assert.equal(login.current().username,'cad2');
 assert.equal(requests[0].url,'https://demo.supabase.co/auth/v1/token?grant_type=password');
 assert.equal(JSON.parse(requests[0].opts.body).email,'cad2@cad-demo.invalid');
 assert.equal(login.client().anonKey,'publishable');
 assert.equal(login.client().getAccessToken(),'test-token');
 login.logout();
 assert.equal(login.current(),null);
 assert.throws(()=>login.client(),/login required/);
 console.log('CAD demo login tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
