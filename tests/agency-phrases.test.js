const assert=require('node:assert/strict');
const {compile}=require('../core/agency-phrases.js');
const dictionary=compile([
 {intent:'unit.available',phrases:['Show me available','available units']},
 {intent:'unit.unavailable',phrases:['out of service','make unavailable']},
 {intent:'incident.clear',phrases:['clear incident','close the call']},
 {intent:'unit.available',phrases:['OUT OF SERVICE']}
]);
assert.deepEqual(dictionary.resolve('  AVAILABLE units!'),{status:'matched',intent:'unit.available',phrase:'available units'});
assert.deepEqual(dictionary.resolve('close the call'),{status:'matched',intent:'incident.clear',phrase:'close the call'});
assert.equal(dictionary.resolve('out of service').status,'ambiguous');
assert.equal(dictionary.resolve('unrecognized command').status,'unknown');
assert.deepEqual(compile([]).conflicts,[]);
console.log('Agency phrase dictionary and ambiguity safeguards passed.');
