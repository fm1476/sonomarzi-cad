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
const duplicate=compile([{intent:'map.hydrants',phrases:['show hydrants','Show Hydrants!']}]);
assert.equal(duplicate.resolve('SHOW HYDRANTS').intent,'map.hydrants');
const collision=compile([{intent:'unit.available',phrases:['Ready for duty']},{intent:'unit.unavailable',phrases:['ready, for duty!']}]);
assert.equal(collision.resolve('ready for duty').status,'ambiguous');
assert.deepEqual(collision.conflicts,['ready for duty']);
assert.equal(compile([{intent:'unit.available',phrases:['show available units']}]).resolve('show available units now').status,'unknown');
console.log('Agency phrase dictionary and ambiguity safeguards passed.');
