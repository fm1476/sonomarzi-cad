const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('map.js','utf8');
const a=src.indexOf('function isMapVoiceCommand(raw){'),b=src.indexOf('function syncSelect(){',a);
assert(a>=0&&b>a,'map voice classifier must be registered');
const part=src.slice(a,b);
const context={window:{},document:{getElementById:()=>({value:''})},ask:()=>{}};
vm.createContext(context);vm.runInContext(part,context);
for(const phrase of [
 'show hydrants','hide hydrants','clear all layers',
 'show fire stations','show police beats','turn on building footprints',
 'show flood zones','show evacuation zones','show address points',
 'zoom to 123 Main Street','go to 725 D Street','center on 123 Main Street',
 'where is 3A14','show available units','show pending calls',
 'show all P1 calls','show units assigned to event 26-004521'
])assert.equal(context.window.cadIsMapVoiceCommand(phrase),true,phrase);
for(const phrase of ['E1 dispatched to event 26-004521','3A14 on scene','314 clear','PREEMPT E1 to event 26-004521','E1 working structure fire']){
 assert.equal(context.window.cadIsMapVoiceCommand(phrase),false,phrase);
}
const voice=fs.readFileSync('voice.js','utf8');
const target=voice.slice(voice.indexOf('process=function(text,source=el('));
assert(target.indexOf('cadMapVoiceCommand?.(text)')>=0);
assert(target.indexOf('cadMapVoiceCommand?.(text)')<target.indexOf('cadSharedIsActive?.()'),'map commands must bypass shared guard');
assert(src.includes('window.SpeechRecognition||window.webkitSpeechRecognition'),'localhost map mic requires browser speech fallback');
console.log('PASS: map speech routes independently of shared transactions with no dangerous command collision');
