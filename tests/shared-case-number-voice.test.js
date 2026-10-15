const assert=require('node:assert/strict');
const intents=require('../core/shared-voice-intents.js');
const dictionary=require('../core/voice-text.js');
const units=[{id:'3A12'},{id:'E1'}];
assert.equal(intents.callsigns('three out of 12 request a case number',units,dictionary)?.id,'3A12');
assert.equal(intents.callsigns('three Adam twelve request a case number',units,dictionary)?.id,'3A12');
assert.equal(intents.callsigns('enter on a copy unseen with a confirmed working structure fire',units,dictionary),null);
console.log('PASS: radio callsign case request and ambiguity');
