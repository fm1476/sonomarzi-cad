// Netlify server-side audio transcription: never exposes OPENAI_API_KEY to browsers.
const ALLOWED=new Set(['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a']);
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method not allowed'};
 const key=process.env.OPENAI_API_KEY;
 if(!key)return {statusCode:503,body:JSON.stringify({error:'OpenAI API key not configured'})};
 const type=(event.headers?.['content-type']||event.headers?.['Content-Type']||'').split(';')[0].toLowerCase();
 if(!ALLOWED.has(type))return {statusCode:415,body:JSON.stringify({error:'Unsupported audio content type'})};
 let bytes;try{bytes=Buffer.from(event.body||'',event.isBase64Encoded?'base64':'utf8');}catch{return {statusCode:400,body:'Bad body'}}
 if(bytes.length<150||bytes.length>3500000)return {statusCode:413,body:'Audio length invalid'};
 const ext=type==='audio/mp4'?'mp4':type==='audio/wav'?'wav':type==='audio/mpeg'?'mp3':type==='audio/ogg'?'ogg':type==='audio/x-m4a'?'m4a':'webm';
 const form=new FormData();form.append('file',new Blob([bytes],{type}),`radio.${ext}`);
 form.append('model',process.env.OPENAI_TRANSCRIBE_MODEL||'gpt-4o-transcribe');
 form.append('prompt','Public safety radio dispatch in Petaluma. Unit callsigns include 3A12, 3A14, 3A16, 3A18, 3A21, and 3A22, spoken as Three Adam Twelve, Three Adam Fourteen, Three Adam Sixteen, Three Adam Eighteen, Three Adam Twenty One, Three Adam Twenty Two. Status terms: dispatched, enroute, on scene, code four, available on scene, clear, clear with disposition. Dispatch terminology: traffic collision, unwanted subject, respond, copy, case number, Petaluma Boulevard, Main Street. Preserve spoken operational facts; do not fabricate.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),22000);
 try{
  const result=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:controller.signal});
  if(!result.ok)return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Transcription provider failed',upstreamStatus:result.status})};
  const data=await result.json();if(typeof data.text!=='string'||!data.text.trim())throw new Error('Empty transcript');
  return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({text:data.text.slice(0,5000)})};
 }catch{return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Audio transcription unavailable'})};}
 finally{clearTimeout(timer);}
};
