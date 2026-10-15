const assert=require('node:assert/strict');
const {classify,callsigns}=require('../core/shared-voice-intents.js');
const dictionary=require('../core/voice-text.js');
const roster=['3A12','3A14','3C21'].map(id=>({id}));
for(const [text,kind,status,id] of [
 ['three item 12 is code for','STATUS','CODE4','3A12'],
 ['$314 clear','CLEAR',undefined,'3A14'],
 ['314 in route','STATUS','ENROUTE','3A14'],
 ['three out of 14th on a traffic stop 123 Main Street','REVIEW',undefined,'3A14'],
 ['3 out of 14 on scene','STATUS','ONSCENE','3A14'],
 ['3 Adam 14 en route','STATUS','ENROUTE','3A14'],
 ['3 Charlie 21 on scene','STATUS','ONSCENE','3C21'],
 ['314 code four','STATUS','CODE4','3A14'],
 ['314 clear','CLEAR',undefined,'3A14']
]){
 const parsed=classify(text);
 assert.equal(parsed.kind,kind,text);
 if(status)assert.equal(parsed.status,status,text);
 assert.equal(callsigns(text,roster,dictionary)?.id,id,text);
}
for(const text of ['314 not clear','314 do not go on scene','314 disregard code four']){
 assert.equal(classify(text).kind,'REVIEW',text);
}
assert.equal(callsigns('123 Main Street on scene',roster,dictionary),null);
assert.equal(callsigns('314 on scene',[...roster,{id:'31B4'}],dictionary),null);
console.log('PASS: shared voice status phrases and unique roster resolution');
