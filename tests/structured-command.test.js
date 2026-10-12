const assert=require('node:assert/strict');
require('../structured-command.js');
const {parse,natural}=globalThis.cadStructuredParse;
const units=['3A12','3A14','E1'];
const examples=[
 'TS 3A12 @1562 Henry Way@ .SAM123. ,red Toyota truck',
 '3A12 TS @1562 Henry Way@ .SAM123. ,red Toyota truck',
 '@1562 Henry Way@ TS .SAM123. 3A12 ,red Toyota truck',
 '@1562 Henry Way@ ,red Toyota truck, .SAM123. TS 3A12',
 'TS @1562 Henry Way@ .SAM123. ,red Toyota truck 3A12',
 '.SAM123. ,red Toyota truck, @1562 Henry Way@ 3A12 TS'
];
for(const x of examples){const a=parse(x,units);assert.deepEqual([a.code,a.unit,a.address,a.identifier,a.notes,a.residual],['TS','3A12','1562 Henry Way','SAM123','red Toyota truck','']);}
assert.deepEqual([parse('CL @1562 Henry Way@ 3A12',units).code,parse('3A12 @1562 Henry Way@ CL',units).unit],['CL','3A12']);
assert.match(parse('TS 3A12 3A14 @1562 Henry Way@',units).error,/More than one/);
assert.match(parse('TS 3A12 @A@ @B@',units).error,/one @address/);
const n=natural('3A12 is stopping a red Toyota truck at 1562 Henry Way, plate SAM123',units);
assert.equal(n.code,'TS');assert.equal(n.unit,'3A12');assert.equal(n.address,'1562 Henry Way');assert.equal(n.identifier,'SAM123');
const cl=natural('Change unit location of 3A12 to 1562 Henry Way',units);
assert.equal(cl.code,'CL'); assert.equal(cl.unit,'3A12');assert.equal(cl.address,'1562 Henry Way');
assert.match(natural('3A12 is on a traffic stop',units).error,/address/i);
console.log('Structured and natural typed command checks passed:',examples.length+6);
