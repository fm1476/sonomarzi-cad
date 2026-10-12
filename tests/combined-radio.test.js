const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','voice.js'),'utf8');
const start=code.indexOf('function splitArrivalAndDispatch(text){');
const end=code.indexOf('\nprocess=function(text,source=',start);
assert(start>0&&end>start,'Combined handler is present');
const ctxt={unitMatches:(s)=>{
 const matches=[...String(s).matchAll(/(?:engine|truck|battalion|medic)\s*(?:\d+|one|two|three|four|five|six)/gi)];
 return matches.map(m=>({id:m[0]}));
}};
vm.createContext(ctxt);
vm.runInContext(code.slice(start,end),ctxt);
const tests=[
 ['Copy Engine 1 on scene confirmed working structure fire. Break. Start Engine 2 and Engine 3 to the working fire',true],
 ['Engine 1 on scene with a confirmed working structure fire, requesting additional units, send Engine 2 to 1000 Lakeville St',true],
 ['Engine 1 on scene with a possible structure fire, start Engine 2',false],
 ['Engine 1 on scene confirmed working structure fire requesting additional units',false],
 ['Engine one, I copy you on scene with a working structure fire, requesting additional units. Break. Engine two, Battalion one, Truck one, respond structure fire, 1000 Lakeville Street.',true],
 ['Copy. Engine 1 is on scene. Confirmed working structure fire, requesting additional units. Break. Engine 2, Engine 3, and Battalion 1, respond structure fire 1000 Lakeville Street.',true],
 ['Start Engine 2 to the structure fire',false],
];
for(const [speech,expected] of tests){
 const value=vm.runInContext('splitArrivalAndDispatch('+JSON.stringify(speech)+')',ctxt);
 assert.equal(Boolean(value),expected,speech);
 if(value){assert(!/Engine (?:1|one)\b/i.test(value.dispatch),'reporting engine is not dispatched again');assert(/Engine (?:1|one)\b/i.test(value.report),'arrival retains reporting engine');}
}
console.log('PASS: combined radio split, no premature dispatch, uncertain reports retained, reporting unit excluded');
