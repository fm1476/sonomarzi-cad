const assert = require('node:assert/strict');
const { normalize, matches, filterUnits } = require('../core/discipline.js');
assert.equal(normalize(' law '), 'LAW');
assert.equal(normalize('invalid'), 'ALL');
assert.equal(normalize(null), 'ALL');
const units = [
  { id: 'L1', discipline: 'LAW' },
  { id: 'F1', discipline: 'FIRE' },
  { id: 'M1', discipline: 'EMS' }
];
assert.deepEqual(filterUnits(units, 'ALL').map(u => u.id), ['L1', 'F1', 'M1']);
for (const [discipline, id] of [['LAW', 'L1'], ['FIRE', 'F1'], ['EMS', 'M1']]) {
  assert.deepEqual(filterUnits(units, discipline).map(u => u.id), [id]);
}
assert.equal(matches({ discipline: 'LAW' }, 'FIRE'), false);
assert.deepEqual(filterUnits(null, 'LAW'), []);
console.log('Shared CAD discipline filter tests passed.');
