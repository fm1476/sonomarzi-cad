/* Standalone acceptance fixture. No Supabase client, auth or production scripts loaded. */
(()=>{'use strict';
const agencyId='fictional-agency';
const types=[{id:'fictional-fire',name:'Structure Fire',discipline:'FIRE',publication:'ACTIVE'},{id:'fictional-medical',name:'Medical Aid',discipline:'FIRE',publication:'ACTIVE'},{id:'fictional-law',name:'Alarm',discipline:'LAW',publication:'ACTIVE'}];
const units=['E1','E2','E3','T1','M1'].map((name,i)=>({id:name,call_sign:name,designator:name,agency_id:agencyId,agencyId,discipline:'FIRE',resource_type:name[0]==='E'?'ENGINE':name[0]==='T'?'TRUCK':'AMBULANCE',resourceType:name[0]==='E'?'ENGINE':name[0]==='T'?'TRUCK':'AMBULANCE',stationName:i<2?'Station 1':'Station 2'}));
const plans=[{id:'fictional-plan',agencyId,cfsTypeId:types[0].id,type:'Structure Fire',status:'DRAFT',discipline:'FIRE',area:'TEST ZONE',resources:[{type:'ENGINE',count:2,preferredUnits:['E1','E2','E3']},{type:'TRUCK',count:1,preferredUnits:['T1']}],alarmLevels:[{id:'alarm-2',name:'Second Alarm',rank:2,mode:'TOTAL',resources:[{type:'ENGINE',count:3,preferredUnits:['E1','E2','E3']},{type:'TRUCK',count:1,preferredUnits:['T1']}]},{id:'alarm-3',name:'Third Alarm',rank:3,mode:'ADDITIVE',resources:[{type:'AMBULANCE',count:1,preferredUnits:['M1']}]}]}];
const client={loadCfsCatalog:async()=>structuredClone(types),listAgencySettings:async()=>[{document_key:'smcad-response-plans-v1',version:1,payload:{raw:JSON.stringify(plans)}}],listUnits:async()=>structuredClone(units),listSharedCrews:async()=>[{id:'crew-1',name:'Station 1 Cross Staff',agencyId}],listSharedCrewUnits:async()=>[{crew_id:'crew-1',unit_id:'E1'},{crew_id:'crew-1',unit_id:'E2'}],saveCloudSetting:async()=>{throw new Error('Database writes disabled in fictional acceptance lab')}};
window.CadDemoLogin={current:()=>({agencyId}),client:()=>client};
window.CadCloudSettings={sharedMaster:()=>({agencies:[{id:agencyId,name:'Fictional Fire Department'}]})};
window.CadAgencyMaster={read:()=>({agencies:[{id:agencyId,name:'Fictional Fire Department'}],units:structuredClone(units)})};
window.CadResourceTypes={forAgency:(_agency,discipline)=>discipline==='FIRE'?['ENGINE','TRUCK','AMBULANCE'].map(name=>({name})):[]};
})();
