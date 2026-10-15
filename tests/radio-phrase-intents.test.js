const assert=require('node:assert/strict');
const {classify,catalog}=require('../core/radio-phrase-intents.js');
assert.equal(catalog.length,2);
for(const [speech,id] of [
 ['3 Adam 21 out with a subject at 123 Main Street','SUBJECT_CONTACT'],
 ['3A21 out with subject','SUBJECT_CONTACT'],
 ['3A21 pedestrian contact','SUBJECT_CONTACT'],
 ['3A21 follow up on case 4521','FOLLOW_UP'],
 ['three adam twenty one following up on previous incident','FOLLOW_UP'],
 ['follow-up investigation','FOLLOW_UP']
])assert.equal(classify(speech)?.id,id,speech);
for(const speech of ['3A21 not out with subject','do not follow up','three Adam twenty one respond traffic collision','123 Main Street']){
 assert.equal(classify(speech),null,speech);
}
console.log('PASS: operational radio intents are recognized without automatic mutations');
