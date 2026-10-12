/* Order-independent field extraction for CL / TS. Pure helper, shared by UI and tests. */
(function(root){
'use strict';
function parse(raw, knownUnits=[]){
 const text=String(raw||'').trim();
 const addresses=[...text.matchAll(/@([^@]+)@/g)];
 if(addresses.length>1)return {error:'Only one @address@ may be used per command.'};
 const identities=[...text.matchAll(/\.([^\.\n]+)\./g)];
 if(identities.length>1)return {error:'Only one .plate or person. field may be used.'};
 let working=text.replace(/@([^@]+)@/g,' ').replace(/\.([^\.\n]+)\./g,' ');
 // A paired comma encloses an embedded note; a single trailing comma starts remarks.
 let notes='';const first=working.indexOf(',');
 if(first>=0){const second=working.indexOf(',',first+1);if(second>=0){notes=working.slice(first+1,second).trim();working=working.slice(0,first)+' '+working.slice(second+1);}else{notes=working.slice(first+1).trim();working=working.slice(0,first)}}
 const commandTokens=[...working.matchAll(/\b(CL|TS)\b/gi)];
 if(commandTokens.length>1)return {error:'Use one CL or TS action per command.'};
 const code=commandTokens[0]?.[1]?.toUpperCase()||null;
 if(code)working=working.replace(/\b(CL|TS)\b/i,' ');
 const upper=working.toUpperCase();const found=[...new Set(knownUnits.filter(id=>new RegExp('(?:^|[^A-Z0-9])'+String(id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^A-Z0-9])','i').test(upper)||new RegExp('(?:^|[^A-Z0-9])'+String(id)+'(?=$|[^A-Z0-9])','i').test(notes)))];
 if(found.length>1)return {error:'More than one unit identified; specify a single unit.'};
 const unit=found[0]||null;
 if(unit){working=working.replace(new RegExp('(^|[^A-Z0-9])('+unit+')(?=$|[^A-Z0-9])','i'), '$1 ');notes=notes.replace(new RegExp('(^|[^A-Z0-9])('+unit+')(?=$|[^A-Z0-9])','i'),'$1 ').trim();}
 return {code,unit,address:addresses[0]?.[1]?.trim()||'',identifier:identities[0]?.[1]?.trim()||'',notes,residual:working.trim().replace(/\s+/g,' ')};
}
function natural(raw,knownUnits=[]){
 const text=String(raw||'').trim();if(text.includes('@')||!text)return null;
 const isTraffic=/\btraffic\s+stop\b|\bstopping\s+(?:a|an|the)\b|\bvehicle\s+stop\b/i.test(text);
 const isLocation=/\b(?:change|update|set)\s+(?:the\s+)?(?:unit\s+)?location\b/i.test(text);
 if(!isTraffic&&!isLocation)return null;
 const found=knownUnits.filter(id=>new RegExp('(?:^|[^A-Z0-9])'+id+'(?=$|[^A-Z0-9])','i').test(text));
 if(found.length!==1)return {error:'Natural language requires exactly one recognized unit ID.'};
 const unit=found[0];
 const address=(text.match(/\b(?:at|on|near|to)\s+(\d{1,6}\s+[A-Za-z0-9 ]+?)(?=\s*[,;.]|\s+(?:with|plate|license|driving|vehicle|blue|red|white|black)\b|$)/i)||[])[1]?.trim();
 if(!address)return {error:'Could not confidently identify an address. Use @address@ to specify the location.'};
 const identifier=(text.match(/\b(?:plate|license\s*plate|registration|tag)\s*(?:number|is|:)?\s*([A-Z0-9-]{3,12})\b/i)||[])[1]||'';
 return {code:isTraffic?'TS':'CL',unit,address,identifier,notes:text, residual:'',natural:true};
}
root.cadStructuredParse={parse,natural};
})(typeof window==='undefined'?globalThis:window);
