const assert=require('node:assert/strict');
const {compile}=require('../core/agency-phrases.js');
const {evaluate}=require('../core/command-gate.js');
const dictionary=compile([
 {intent:'unit.available',phrases:['show available units']},
 {intent:'incident.clear',phrases:['clear incident']},
 {intent:'admin.erase',phrases:['erase all data']},
 {intent:'unit.unavailable',phrases:['same phrase']},
 {intent:'unit.available',phrases:['same phrase']}
]);
assert.deepEqual(evaluate(dictionary.resolve('show available units')),{status:'recognized',intent:'unit.available',executionAllowed:false});
assert.deepEqual(evaluate(dictionary.resolve('clear incident')),{status:'needs_context',intent:'incident.clear',required:['incidentId']});
assert.deepEqual(evaluate(dictionary.resolve('clear incident'),{incidentId:'INC-1'}),{status:'recognized',intent:'incident.clear',executionAllowed:false});
assert.deepEqual(evaluate(dictionary.resolve('erase all data')),{status:'rejected',reason:'unsupported_intent'});
assert.deepEqual(evaluate(dictionary.resolve('same phrase')),{status:'rejected',reason:'ambiguous'});
assert.deepEqual(evaluate(dictionary.resolve('unknown')),{status:'rejected',reason:'unknown'});
console.log('Non-executing command gate tests passed.');
