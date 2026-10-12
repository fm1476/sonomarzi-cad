/* Single authoritative metadata catalog for agency-configurable voice intents. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CadIntentCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=Object.freeze({
  'unit.available':Object.freeze({label:'Show Available Units',kind:'query',permission:'units.read',required:Object.freeze([]),confirmation:false}),
  'unit.unavailable':Object.freeze({label:'Show Unavailable Units',kind:'query',permission:'units.read',required:Object.freeze([]),confirmation:false}),
  'incident.clear':Object.freeze({label:'Clear Incident',kind:'operational',permission:'incidents.clear',required:Object.freeze(['incidentId']),confirmation:true}),
  'map.hydrants':Object.freeze({label:'Show Hydrants',kind:'map',permission:'map.read',required:Object.freeze([]),confirmation:false}),
  'map.schools':Object.freeze({label:'Show Schools',kind:'map',permission:'map.read',required:Object.freeze([]),confirmation:false})
 });
 return Object.freeze({catalog,ids:Object.freeze(Object.keys(catalog))});
});
