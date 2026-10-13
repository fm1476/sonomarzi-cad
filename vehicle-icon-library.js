/* Local, dependency-free public-safety vehicle icon picker. */
(function(root){
'use strict';
const items=[
['fire-engine','Fire','Fire Engine','engine truck pumper','truck'],['ladder-truck','Fire','Ladder Truck','aerial ladder','ladder'],['tiller','Fire','Tiller Truck','tractor drawn aerial','ladder'],['quint','Fire','Quint','engine ladder','ladder'],['brush-truck','Fire','Brush Truck','wildland pickup','pickup'],['red-pickup','Fire','Red Pickup','utility pickup','pickup'],['water-tender','Fire','Water Tender','water truck tanker','tanker'],['heavy-rescue','Fire','Heavy Rescue','rescue squad truck','truck'],['command-suv','Fire','Command SUV','battalion chief','suv'],
['ambulance','EMS','Ambulance','medical transport','ambulance'],['medic-unit','EMS','Medic Unit','paramedic ambulance','ambulance'],['ems-suv','EMS','EMS Supervisor','medical suv','suv'],['ems-bus','EMS','Mass Casualty Bus','medical bus','bus'],
['police-car','Law','Police Sedan','patrol car','sedan'],['police-suv','Law','Police SUV','patrol sport utility','suv'],['police-truck','Law','Police Pickup','pickup truck','pickup'],['police-motorcycle','Law','Police Motorcycle','motorcycle traffic','motorcycle'],['police-van','Law','Police Van','transport van','van'],['police-bus','Law','Police Bus','transport bus','bus'],['armored-vehicle','Law','Armored Police Vehicle','bearcat tactical armored','armored'],['police-command','Law','Mobile Command Unit','command bus mobile','bus'],
['utility-truck','Specialty','Utility Truck','service pickup','pickup'],['eod-truck','Specialty','EOD Truck','bomb squad','truck'],['k9-suv','Specialty','K9 SUV','canine vehicle','suv'],['drone-truck','Specialty','Drone Unit','uav truck','pickup']
].map(([id,category,label,search,shape])=>({id,category,label,search,shape}));
const shapes={
truck:'<path d="M3 24V12h26v12H3Zm26-9h11l7 8v1H29V15Z"/><path d="M32 18h7l4 5H32z" class="window"/>',
ladder:'<path d="M3 24V14h28v10H3Zm28-8h9l7 8H31v-8Z"/><path d="M7 11 37 4M9 14 39 7M9 10l3 3m4-5 3 3m4-5 3 3m4-5 3 3m4-5 3 3" class="detail"/>',
pickup:'<path d="M3 24V17h18l5-8h11l8 10v5H3Z"/><path d="M28 12h7l5 6H24z" class="window"/><path d="M5 20h15" class="detail"/>',
tanker:'<rect x="3" y="11" width="29" height="13" rx="5"/><path d="M32 14h9l6 8v2H32z"/><path d="M36 17h4l3 4h-7z" class="window"/>',
ambulance:'<path d="M3 24V8h29v16H3Zm29-11h8l7 8v3H32V13Z"/><path d="M35 16h4l4 5h-8z" class="window"/><path d="M17 11v10m-5-5h10" class="detail"/>',
sedan:'<path d="M3 24v-6h7l7-8h18l7 8h5v6H3Z"/><path d="M19 13h14l6 5H14z" class="window"/>',
suv:'<path d="M3 24V15l9-7h23l10 10v6H3Z"/><path d="M14 11h19l7 7H7z" class="window"/>',
van:'<path d="M3 24V10h34l10 10v4H3Z"/><path d="M31 13h5l7 7H31z" class="window"/>',
bus:'<path d="M3 24V8h42v16H3Z"/><path d="M7 12h7v7H7zm10 0h7v7h-7zm10 0h7v7h-7zm10 0h4v7h-4z" class="window"/>',
armored:'<path d="M3 24V15l9-8h23l12 11v6H3Z"/><path d="M16 11h16l7 7H9z" class="window"/><path d="M6 20h37M12 7l4-3h14l5 3" class="detail"/>',
motorcycle:'<circle cx="11" cy="23" r="6" class="wheel"/><circle cx="39" cy="23" r="6" class="wheel"/><path d="m11 23 10-13 8 13H11l8-8m10 8 7-12 4 12M18 9h8m10 2h6" class="detail"/>'
};
function svg(id,opts={}){
 const item=items.find(x=>x.id===id);if(!item)return '<span aria-hidden="true">▣</span>';
 const c=opts.color|| (item.category==='Fire'?'#ef6c68':item.category==='EMS'?'#5ac3ce':item.category==='Law'?'#7eaef6':'#c7b5ff');
 const body=shapes[item.shape]||shapes.truck;
 return '<svg class="cad-vehicle-icon" viewBox="0 0 50 34" width="50" height="34" role="img" aria-label="'+item.label+'" xmlns="http://www.w3.org/2000/svg"><g fill="'+c+'" stroke="#0b2033" stroke-width="1.4" stroke-linejoin="round">'+body+'</g><g fill="#a8d4ed" stroke="#0b2033" stroke-width="1" class="windows"></g><circle cx="12" cy="25" r="4.5" fill="#0b2033" stroke="#93abc0" stroke-width="1.6"/><circle cx="38" cy="25" r="4.5" fill="#0b2033" stroke="#93abc0" stroke-width="1.6"/></svg>'.replace(/class="window"/g,'fill="#b5d7ea"').replace(/class="detail"/g,'fill="none" stroke="#e9f6ff" stroke-width="2"').replace(/class="wheel"/g,'fill="none" stroke="#a5bcd2" stroke-width="2"');
}
function choose(onChoose,current){
 const old=document.getElementById('cadIconLibraryDialog');old?.remove();
 const dlg=document.createElement('dialog');dlg.id='cadIconLibraryDialog';dlg.className='cad-icon-dialog';
 dlg.innerHTML='<div class="cad-icon-heading"><div><h3>Public Safety Icon Library</h3><p>Select a consistent vehicle icon for this resource type.</p></div><button type="button" data-close aria-label="Close icon library">✕</button></div><input type="search" id="cadIconSearch" placeholder="Search engine, ladder, ambulance, SUV, command…"><div class="cad-icon-tabs" id="cadIconTabs"></div><div class="cad-icon-grid" id="cadIconGrid"></div>';
 document.body.append(dlg);let category='All';const cats=['All','Fire','EMS','Law','Specialty'];
 const tabs=dlg.querySelector('#cadIconTabs'),grid=dlg.querySelector('#cadIconGrid'),search=dlg.querySelector('#cadIconSearch');
 function draw(){const q=search.value.toLowerCase().trim();tabs.innerHTML=cats.map(c=>'<button type="button" data-cat="'+c+'" class="'+(category===c?'active':'')+'">'+c+'</button>').join('');grid.innerHTML=items.filter(x=>(category==='All'||x.category===category)&&(!q||(x.label+' '+x.search+' '+x.category).toLowerCase().includes(q))).map(x=>'<button type="button" data-icon="'+x.id+'" class="cad-icon-choice '+(x.id===current?'selected':'')+'">'+svg(x.id)+'<span>'+x.label+'</span></button>').join('')||'<p>No icons match this search.</p>';tabs.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;draw()});grid.querySelectorAll('[data-icon]').forEach(b=>b.onclick=()=>{onChoose(b.dataset.icon);dlg.close();dlg.remove()})}
 search.oninput=draw;dlg.querySelector('[data-close]').onclick=()=>{dlg.close();dlg.remove()};dlg.addEventListener('close',()=>dlg.remove());draw();dlg.showModal();
}
root.CadVehicleIcons={items,svg,choose};
})(window);