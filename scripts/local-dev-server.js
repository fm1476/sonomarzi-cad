// Local CAD server: static POC files plus the existing server-side Netlify
// OpenAI transcription handler. Bind loopback only; never expose API keys.
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.PORT||8001);
const {handler:transcribe}=require('../netlify/functions/transcribe.js');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
const deny=new Set(['.env','.git','.netlify','node_modules','.DS_Store','.npmrc']);
function reply(res,status,body,type='text/plain; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(body);
}
const server=http.createServer(async(req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return reply(res,400,'Bad URL');}
 if(pathname==='/__cad/local-health'){
  return reply(res,200,JSON.stringify({server:'CAD_LOCAL_NODE',openaiConfigured:!!process.env.OPENAI_API_KEY}), 'application/json');
 }
 if(pathname==='/.netlify/functions/transcribe'){
  if(req.method!=='POST')return reply(res,405,'Method not allowed');
  const type=String(req.headers['content-type']||'').split(';')[0];
  if(!['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a'].includes(type))return reply(res,415,'Unsupported audio type');
  const chunks=[];let length=0;
  try{
   for await(const chunk of req){length+=chunk.length;if(length>3500000){return reply(res,413,'Audio exceeds 3.5 MB');}chunks.push(chunk)}
   const result=await transcribe({httpMethod:'POST',headers:{'content-type':type},body:Buffer.concat(chunks).toString('base64'),isBase64Encoded:true});
   return reply(res,result.statusCode,result.body||'',result.headers?.['Content-Type']||'application/json');
  }catch(e){return reply(res,502,'Transcription service error');}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,'Method not allowed');
 const pieces=pathname.split('/').filter(Boolean);
 if(pieces.some(piece=>piece.startsWith('.')||deny.has(piece)))return reply(res,403,'Forbidden');
 let target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(root+path.sep))return reply(res,403,'Forbidden');
 try{
  const stats=await fs.promises.stat(target);
  if(stats.isDirectory())target=path.join(target,'index.html');
  const real=await fs.promises.realpath(target);
  if(!real.startsWith(root+path.sep))return reply(res,403,'Forbidden');
  const data=await fs.promises.readFile(real);
  res.writeHead(200,{'Content-Type':mime[path.extname(real).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  return res.end(req.method==='HEAD'?undefined:data);
 }catch{return reply(res,404,'Not found');}
});
if(require.main===module)server.listen(port,'127.0.0.1',()=>{
 console.log('CAD listening at http://localhost:'+port);
 console.log(process.env.OPENAI_API_KEY?'OpenAI server transcription enabled.':'OPENAI_API_KEY not set: OpenAI unavailable; browser fallback may be used.');
});
module.exports={server};
