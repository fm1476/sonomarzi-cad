const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={config:{types:{LAW:['Suspicious Vehicle'],FIRE:['Hazardous Materials'],EMS:['Lift Assist']}},state:{incidents:[]},window:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','incident-intelligence.js'),'utf8'),ctx);
assert.strictEqual(ctx.window.cadIncidentIntelligence.classification('upgrade event to Hazardous Materials').type,'Hazardous Materials');
assert.strictEqual(ctx.window.cadIncidentIntelligence.classification('confirmed Lift Assist').type,'Lift Assist');
assert.strictEqual(ctx.window.cadIncidentIntelligence.classification('possible Hazardous Materials').review,'Classification not confirmed');
console.log('PASS: configured CFS types recognized by voice reclassification, uncertainty safeguard');
