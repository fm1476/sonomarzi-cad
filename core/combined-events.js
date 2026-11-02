/* Combined-event domain rules. Pure functions; persistence and authorization remain server responsibilities. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CadCombinedEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DISCIPLINES=Object.freeze(['LAW','FIRE','EMS']);
  function discipline(value){
    const d=String(value||'').trim().toUpperCase();
    if(!DISCIPLINES.includes(d))throw new Error('Unsupported discipline');
    return d;
  }
  function normalizeType(value){
    const type=String(value||'').trim();
    if(!type)throw new Error('A discipline-specific CFS type is required');
    return type;
  }
  function rootId(incident){return incident.linkedRoot||incident.linkedFrom||incident.id;}
  function family(incidents,incident){
    const id=rootId(incident);
    return (incidents||[]).filter(item=>rootId(item)===id);
  }
  function existingDiscipline(incidents,incident,target){
    const d=discipline(target);
    return family(incidents,incident).find(item=>discipline(item.discipline)===d)||null;
  }
  function planAdditionalDiscipline(incidents,source,target,type){
    if(!source||!source.id)throw new Error('Source CFS required');
    const d=discipline(target), cfsType=normalizeType(type);
    const existing=existingDiscipline(incidents,source,d);
    if(existing)return {action:'reuse',incident:existing,rootId:rootId(source)};
    return {action:'create',rootId:rootId(source),linkedFrom:source.id,discipline:d,type:cfsType,
      location:source.location||'',caller:source.caller||'',phone:source.phone||'',
      // No law narrative or restricted comments are copied to another discipline.
      narrative:[],events:[],units:[],status:'PENDING'};
  }
  function newComment(text,origin,sharingEnabled,createdAt){
    const d=discipline(origin),body=String(text||'').trim();
    if(!body)throw new Error('Comment required');
    return {text:body,originDiscipline:d,visibility:d==='LAW'&&!sharingEnabled?'LAW_ONLY':'SHARED',
      createdAt:createdAt||new Date().toISOString()};
  }
  function canReadComment(comment,viewerDiscipline){
    const viewer=discipline(viewerDiscipline);
    return comment.visibility==='SHARED'||(comment.visibility==='LAW_ONLY'&&viewer==='LAW');
  }
  function visibleComments(comments,viewerDiscipline){
    return (comments||[]).filter(c=>canReadComment(c,viewerDiscipline));
  }
  return Object.freeze({DISCIPLINES,discipline,rootId,family,existingDiscipline,planAdditionalDiscipline,newComment,canReadComment,visibleComments});
});
