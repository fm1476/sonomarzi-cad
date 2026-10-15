const assert=require('node:assert/strict');
const {server}=require('../scripts/local-dev-server.js');
async function run(){
 delete process.env.OPENAI_API_KEY;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const health=await fetch(base+'/__cad/local-health');
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{server:'CAD_LOCAL_NODE',openaiConfigured:false});
  const home=await fetch(base+'/');
  assert.equal(home.status,200);
  assert((await home.text()).includes('voice.js'));
  const js=await fetch(base+'/voice.js');assert.equal(js.status,200);
  const noSecret=await fetch(base+'/.env');assert.equal(noSecret.status,403);
  const blocked=await fetch(base+'/netlify/functions/transcribe.js');assert.equal(blocked.status,200);
  const audio=await fetch(base+'/.netlify/functions/transcribe',{method:'POST',headers:{'Content-Type':'audio/webm'},body:Buffer.alloc(200)});
  assert.equal(audio.status,503,'without server key, OpenAI route reports unavailable');
  assert((await audio.json()).error.includes('not configured'));
  console.log('PASS: local CAD server hosts app securely and exposes server-side transcription without client key');
 }finally{await new Promise(resolve=>server.close(resolve))}
}
run().catch(error=>{console.error(error);process.exitCode=1;server.close()});
