const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const requiredIds=['cadConfigSection','cadPhraseIntent','cadPhraseAliases','cadPhraseAdd','cadPhraseList','cadPhraseTest','cadPhraseTestButton','cadPhraseValidate','cadPhraseResult','cadPhraseJson','cadPhraseApplyJson'];
for(const id of requiredIds){
 assert.match(html,new RegExp('id=["\\x27]'+id+'["\\x27]'),'Missing UI control '+id);
}
assert.match(html,/data-config-panel="phrases"/);
const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
for(const file of ['core/agency-phrases.js','core/intent-catalog.js','core/command-gate.js','core/action-plan.js','agency-phrase-settings.js']){
 assert.ok(scripts.includes(file),'Missing script '+file);
}
assert.ok(scripts.indexOf('core/agency-phrases.js')<scripts.indexOf('agency-phrase-settings.js'));
assert.ok(scripts.indexOf('core/intent-catalog.js')<scripts.indexOf('core/command-gate.js'));
assert.ok(scripts.indexOf('core/intent-catalog.js')<scripts.indexOf('core/action-plan.js'));
assert.ok(scripts.indexOf('core/command-gate.js')<scripts.indexOf('agency-phrase-settings.js'));
assert.ok(scripts.indexOf('core/action-plan.js')<scripts.indexOf('agency-phrase-settings.js'));
for(const file of scripts.filter(s=>!s.startsWith('https://')&&!s.startsWith('http://'))){
 assert.ok(fs.existsSync(path.join(__dirname,'..',file)),'Script missing on disk: '+file);
}
console.log('CAD HTML controls, script files and dependency order validated.');
