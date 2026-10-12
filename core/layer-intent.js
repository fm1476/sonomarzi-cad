/* Pure map-layer voice intent recognition; no map mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadLayerIntent=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function parse(raw,LIST){const text=String(raw||'').toLowerCase().replace(/[.,?!]/g,' ').replace(/\s+/g,' ');
  const isLayer=/\b(layer|layers|hydrants?|stations?|zones?|beats?|parcels?|buildings?|schools?|flood|fire hazard|wildland|evacuation|sheriff|road closures|traffic incidents|address points)\b/.test(text);
  if(!isLayer)return null;
  if(/\b(?:clear|reset|hide|remove|turn off)\s+(?:all\s+)?layers\b/.test(text))return {action:'clear',ids:[]};
  const matches=LIST.filter(x=>x.terms.some(w=>new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(text)));
  if(!matches.length)return null;
  const hide=/\b(hide|remove|turn off|disable|clear)\b/.test(text);
  return {action:hide?'hide':'show',ids:matches.map(x=>x.id),only:/\b(only|just)\b/.test(text)&&!hide};
}
return Object.freeze({parse});
});
