const fs=require('fs'),vm=require('vm'),assert=require('assert');
const base=__dirname+'/../';
const voice=fs.readFileSync(base+'voice.js','utf8');
const extended=fs.readFileSync(base+'extended-ops.js','utf8');
const units=['E1','E2','E3','B1','T1','3A21','3A22'].map(id=>({id}));
const ctx={state:{units},console,normalize:require('../core/voice-text.js').normalize};vm.createContext(ctx);
const voiceSubset=voice.slice(voice.indexOf('function aliases(id)'),voice.indexOf('function normalizeRadioStatus('));
vm.runInContext(voiceSubset+'\nthis.extract=unitMatches',ctx);
function matches(t){return Array.from(ctx.extract(t),u=>u.id).sort()}
assert.deepStrictEqual(matches('Engine 2 and Engine 3 respond to structure fire at 1000 Lakeville St'),['E2','E3']);
assert.deepStrictEqual(matches('E2 and E3 respond to the working fire'),['E2','E3']);
assert.deepStrictEqual(matches('Battalion 1 and Truck 1 respond to E1 location'),['B1','E1','T1']);
assert.deepStrictEqual(matches('3 Adam 21 and 3 Adam 22 respond'),['3A21','3A22']);
const extSubset=extended.slice(extended.indexOf('const normalize='),extended.indexOf('function feedback('));
const ec={console};vm.createContext(ec);vm.runInContext(extSubset+'\nthis.logonCalls=getCallsigns',ec);
function logs(t){return Array.from(ec.logonCalls(t),u=>u.id)}
assert.deepStrictEqual(logs('logging on Battalion 1 and Truck 1'),['B1','T1']);
assert.deepStrictEqual(logs('Engine 2 and Engine 3 logging on'),['E2','E3']);
assert.deepStrictEqual(logs('Three Adam Twenty One and Engine 2 logging on'),['3A21','E2']);
console.log('PASS: multiple unit callsigns in dispatch and logon phrases');
