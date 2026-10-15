const assert = require('node:assert/strict');
const { normalize, phonetics, numericCallsigns } = require('../core/voice-text.js');
assert.equal(normalize('3Adam14, respond!'), '3adam14 respond');
assert.equal(normalize('BATALLION 1'), 'battalion 1');
assert.equal(normalize('  ENGINE-2,  ON_SCENE? '), 'engine 2 on scene');
assert.equal(normalize('Show LAW units.'), 'show law units');
console.log('Voice text normalization regression tests passed.');

const expected=['adam','boy','charles','david','edward','frank','george','henry','ida','john','king','lincoln','mary','nora','ocean','paul','queen','robert','sam','tom','union','victor','william','xray','young','zebra'];
assert.equal(Object.keys(phonetics).length,26);
expected.forEach((word,index)=>{
 const id='3'+String.fromCharCode(65+index)+'21';
 assert.deepEqual(numericCallsigns('three '+word+' twenty one respond traffic collision 123 Main Street'),[id],word);
});
for(const [spoken,id] of [
 ['three item 21 respond','3A21'],['three atom 21 respond','3A21'],
 ['three alpha 21 respond','3A21'],['three charlie 21 respond','3C21'],
 ['3 echo 14 respond','3E14'],['3 victoria fourteen respond','3V14'],
 ['3 whiskey twenty one respond','3W21'],['3 zulu 21 respond','3Z21'],
 ['3A21 respond','3A21'],['3Charles21 respond','3C21']
]) assert.deepEqual(numericCallsigns(spoken),[id],spoken);
assert.deepEqual(numericCallsigns('123 Main Street traffic collision'),[]);
assert.deepEqual(numericCallsigns('We have three items 21 people'),[]);
assert.deepEqual(numericCallsigns('3 Charlie respond'),[]);
console.log('Full phonetic alphabet and callsign safety cases passed.');
