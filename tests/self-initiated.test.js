const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const config={types:{LAW:['Traffic Stop','Attempt to Contact'],FIRE:['Structure Fire'],EMS:['Medical Aid']},selfInitiated:{LAW:{'Traffic Stop':{enabled:true,code:'TS',status:'ONSCENE'},'Attempt to Contact':{enabled:true,code:'ATC',status:'ENROUTE'}}}};
const state={seq:100,incidents:[],units:[{id:'3A12',discipline:'LAW',agency:'Petaluma Police',status:'AVAILABLE',location:'Beat 1'}]};
const elements={saveConfig:{onclick(){},},selfInitiatedSettings:{innerHTML:'',append(){}},voiceInterpretation:{textContent:''}};
const fake=()=>({dataset:{},append(){},prepend(){},add(){},value:'',textContent:''});const doc={getElementById:id=>elements[id]||null,querySelector:()=>null,querySelectorAll:()=>[],createElement:fake};
const ctx={window:{},document:doc,config,state,localStorage:{setItem(){}},structuredClone,Option:class{},setTimeout,Date,console,save(){},};ctx.window.cadBeforeVoiceProcess=()=>false;ctx.window.cadResolveUnitAddress=()=>{};// Production: voice.js unitMatches is NOT global.
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','structured-command.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','self-initiated.js'),'utf8'),ctx);
const r=ctx.window.cadSelfInitiated.typed('ATC 3A12 @123 Main St@ ,attempt to contact');assert.equal(r.ok,true);assert.equal(state.incidents[0].type,'Attempt to Contact');assert.equal(state.units[0].status,'ENROUTE');assert.equal(state.incidents[0].location,'123 Main St');
state.units[0].status='AVAILABLE';state.incidents=[];
const spoken=ctx.window.cadBeforeVoiceProcess("3A12 I'll be enroute to 123 Main St for an attempt to contact",'VOICE');assert.equal(spoken,true);assert.equal(state.incidents.length,1);assert.equal(state.units[0].status,'ENROUTE');
console.log('self-initiated typed and voice tests passed');

// Regression: natural speech with a configured Common Place and follow-up event.
config.types.LAW.push('Follow Up');config.selfInitiated.LAW['Follow Up']={enabled:true,code:'FU',status:'ONSCENE'};
ctx.window.cadCommonPlaces={resolve:s=>/^(phs|petaluma high school|201 fair st, petaluma, ca)$/i.test(s)?{id:'phs',name:'Petaluma High School',address:'201 Fair St, Petaluma, CA',coordinates:[38.23,-122.64]}:null,list:()=>[{id:'phs',name:'Petaluma High School',aliases:['PHS'],address:'201 Fair St, Petaluma, CA'}]};
state.units[0].status='AVAILABLE';state.incidents=[];
const follow=ctx.window.cadBeforeVoiceProcess("Three Adam Twelve, I'll be out at follow up at Petaluma High School.",'VOICE');
assert.equal(follow,true);assert.equal(state.incidents.length,1);assert.equal(state.incidents[0].type,'Follow Up');assert.equal(state.incidents[0].commonPlaceName,'Petaluma High School');assert.equal(state.incidents[0].location,'201 Fair St, Petaluma, CA');
console.log('Common Place follow-up spoken phrase passed');
// All common radio phrasings must work against the same configured CFS, not hardcoded Follow Up.
for(const phrase of [
 "Three Adam Twelve, I'll be out at follow up at Petaluma High School.",
 "Three Adam Twelve, I'll be on follow up at Petaluma High School.",
 "Three Adam Twelve, out for follow up at Petaluma High School.",
 "Three Adam Twelve, I'll be out on follow up at Petaluma High School.",
 "Three Adam Twelve, follow up at Petaluma High School."
]){
 state.units[0].status='AVAILABLE';state.incidents=[];
 assert.equal(ctx.window.cadSelfInitiated.spoken(phrase),true,`unhandled: ${phrase}`);
 assert.equal(state.incidents[0]?.type,'Follow Up');
 assert.equal(state.incidents[0]?.commonPlaceName,'Petaluma High School');
}
config.types.LAW.push('Property Check');config.selfInitiated.LAW['Property Check']={enabled:true,code:'PC',status:'ENROUTE'};
for(const phrase of ['Three Adam Twelve, out for property check at PHS','Three Adam Twelve, property check at PHS']){
 state.units[0].status='AVAILABLE';state.incidents=[];
 assert.equal(ctx.window.cadSelfInitiated.spoken(phrase),true,`unhandled: ${phrase}`);
 assert.equal(state.incidents[0]?.type,'Property Check');
 assert.equal(state.units[0].status,'ENROUTE');
}
console.log('PASS: generic self-initiated speech variants');

// Production-style transcript and case-insensitive typed command regression.
ctx.window.cadCommonPlaces.list=()=>[{id:'phs',name:'Petaluma High School',aliases:['PHS','Petaluma High'],address:'201 Fair St, Petaluma, CA'}];
ctx.window.cadCommonPlaces.resolve=s=>/^(phs|petaluma high|petaluma high school|201 fair st, petaluma, ca)$/i.test(s)?{id:'phs',name:'Petaluma High School',address:'201 Fair St, Petaluma, CA',coordinates:[38.23,-122.64]}:null;
for(const phrase of ['Three Adam Twelve, out on follow up at Petaluma High.', '3A12 follow-up PHS']){
 state.units[0].status='AVAILABLE';state.incidents=[];
 assert.equal(ctx.window.cadSelfInitiated.spoken(phrase),true,phrase);
 assert.equal(state.incidents.length,1,phrase);
 assert.equal(state.incidents[0].commonPlaceName,'Petaluma High School');
}
for(const command of ['fu 3a12 @phs@','Fu 3A12 @PHS@']){
 state.units[0].status='AVAILABLE';state.incidents=[];
 const r=ctx.window.cadSelfInitiated.typed(command);
 assert.equal(r?.ok,true,`${command}: ${r?.message}`);
 assert.equal(state.incidents[0].location,'201 Fair St, Petaluma, CA');
}
console.log('PASS: screenshot transcripts and lowercase typed commands');

// Regression: multiple spoken units must work WITHOUT importing a private voice.js function.
for(const id of ['3A12','3A14','3A21','3A22']){
 state.units=[{id,discipline:'LAW',agency:'Petaluma Police',status:'AVAILABLE',location:'Available'}];state.incidents=[];
 const last=id.slice(2),numberWords={'12':'Twelve','14':'Fourteen','21':'Twenty One','22':'Twenty Two'};
 const heard=`Three Adam ${numberWords[last]}, out on follow up, Petaluma High.`;
 assert.equal(ctx.window.cadSelfInitiated.spoken(heard),true,heard);
 assert.equal(state.incidents.length,1,heard);
 assert.equal(state.incidents[0].units[0],id,heard);
}
console.log('PASS: four independently spoken units, no global resolver');
// Exact field transcript: configured CFS labels must not require an identical article.
config.types.LAW.push('Out With Subject');
config.selfInitiated.LAW['Out With Subject']={enabled:true,code:'OWS',status:'ONSCENE'};
for(const phrase of [
 "Three Adam Twelve, I'll be out with a subject at 900 B Street.",
 "Three Adam Twelve, out with subject at 900 B Street.",
 "3A12, out with the subject at 900 B Street."
]){
 state.units=[{id:'3A12',discipline:'LAW',agency:'Petaluma Police',status:'AVAILABLE',location:'Available'}];state.incidents=[];
 assert.equal(ctx.window.cadBeforeVoiceProcess(phrase,'VOICE'),true,phrase);
 assert.equal(state.incidents.length,1,phrase);
 assert.equal(state.incidents[0].type,'Out With Subject',phrase);
 assert.equal(state.incidents[0].location,'900 B Street',phrase);
 assert.equal(state.units[0].status,'ONSCENE',phrase);
}
console.log('PASS: agency-configured CFS names with optional spoken articles');

// Spoken street-number regression from real microphone transcription.
for(const [phrase,expected] of [
 ["Three Adam Twelve, I'll be out with a subject, four twenty nine Douglas Street.", '429 Douglas Street'],
 ["Three Adam Twelve, I'll be out with a subject at four twenty nine Douglas Street.", '429 Douglas Street'],
 ["Three Adam Twelve, I'll be out with a subject at fifteen sixty two Henry Way.", '1562 Henry Way'],
 ["Three Adam Twelve, I'll be out with a subject at 429 Douglas Street.", '429 Douglas Street']
]){
 state.units=[{id:'3A12',discipline:'LAW',agency:'Petaluma Police',status:'AVAILABLE',location:'Available'}];state.incidents=[];
 assert.equal(ctx.window.cadSelfInitiated.spoken(phrase),true,phrase);
 assert.equal(state.incidents.length,1,`${phrase} ${elements.voiceInterpretation.textContent}`);
 assert.equal(state.incidents[0].location,expected,phrase);
 assert.equal(state.units[0].status,'ONSCENE',phrase);
}
console.log('PASS: spoken numerical street addresses');
