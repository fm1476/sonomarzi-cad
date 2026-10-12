// Read-only reference data from City of Petaluma ArcGIS Water Hydrants layer 6.
const BASE='https://maps.cityofpetaluma.net/mapping/rest/services/PublicWorks/LUCITY_Water_Distribution/MapServer/6/query';
exports.handler=async(event)=>{
 const params=event.queryStringParameters||{};const mode=params.mode==='all'?'all':'near';
 const lat=Number(params.lat),lon=Number(params.lon),radius=Math.min(1500,Math.max(100,Number(params.radius)||500));
 if(mode==='near'&&(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))return{statusCode:400,body:JSON.stringify({error:'Valid latitude and longitude required'})};
 const features=[];let offset=0;
 try{
  do{
   const q=new URLSearchParams({f:'geojson',where:'1=1',outFields:'OBJECTID,FACILITYID,LOCDESC,ACTIVEFLAG,PSI,LASTUPDATE',outSR:'4326',resultRecordCount:'1000',resultOffset:String(offset)});
   if(mode==='near'){
    q.set('geometry',JSON.stringify({x:lon,y:lat,spatialReference:{wkid:4326}}));q.set('geometryType','esriGeometryPoint');q.set('inSR','4326');q.set('spatialRel','esriSpatialRelIntersects');q.set('distance',String(radius));q.set('units','esriSRUnit_Meter');
   }
   const res=await fetch(`${BASE}?${q}`,{signal:AbortSignal.timeout(13000)});if(!res.ok)throw new Error('GIS returned '+res.status);
   const data=await res.json();if(data.error)throw new Error(data.error.message||'GIS query error');const batch=data.features||[];features.push(...batch);offset+=batch.length;if(batch.length<1000||features.length>=6000)break;
  }while(true);
  return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=120'},body:JSON.stringify({type:'FeatureCollection',features,referenceOnly:true,truncated:features.length>=6000})};
 }catch(error){return{statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:`City hydrant service unavailable: ${error.message}`})}}
};
