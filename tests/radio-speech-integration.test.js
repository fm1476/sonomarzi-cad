const assert=require('node:assert/strict');
const fs=require('node:fs');
const voice=fs.readFileSync(require('node:path').join(__dirname,'../voice.js'),'utf8');
assert.match(voice,/code\\s\+\(\?:four\|for\)/,'Chrome code-for variant must be normalized');
assert.match(voice,/parseStatus\(window\.CadRadioStatusRepair\.repair/,'Repair must be in operational status path');
assert.match(voice,/CadRadioIncomplete\.inspect/,'Incomplete speech must be detected');
assert.match(voice,/setTimeout\(\(\)=>stopRecorder\(id\),350\)/,'PTT release tail must remain');
console.log('Radio speech integration guards passed.');
