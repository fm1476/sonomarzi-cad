/* Explicit opt-in activation of configured units into the demo operations roster. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CadUnitActivation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function activate(master,state,unitId){
 const def=master.units.find(u=>u.id===unitId);if(!def)throw Error('Unknown master unit.');
 const agency=master.agencies.find(a=>a.id===def.agencyId);if(!agency)throw Error('Unknown owning agency.');
 if(state.units.some(u=>u.id.toUpperCase()===def.designator.toUpperCase()))throw Error('Radio designator already active: '+def.designator);
 const unit={id:def.designator,agency:agency.name,agencyId:agency.id,discipline:def.discipline,status:'AVAILABLE',location:'',x:50,y:50,masterUnitId:def.id};
 return {...state,units:[...state.units,unit]};
}
return Object.freeze({activate});
});