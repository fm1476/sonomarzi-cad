const assert = require('node:assert/strict');
const { normalize } = require('../core/voice-text.js');
assert.equal(normalize('3Adam14, respond!'), '3adam14 respond');
assert.equal(normalize('BATALLION 1'), 'battalion 1');
assert.equal(normalize('  ENGINE-2,  ON_SCENE? '), 'engine 2 on scene');
assert.equal(normalize('Show LAW units.'), 'show law units');
console.log('Voice text normalization regression tests passed.');
