const assert=require('node:assert/strict'),fs=require('node:fs');const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('styles.css','utf8'),app=fs.readFileSync('app.js','utf8');
assert(html.includes('styles.css?v=25.6'),'day-mode stylesheet cache must be invalidated');
assert(html.includes('app.js?v=62'),'incident actions must get fresh render code');
assert(css.includes('Day mode v2: consistent dispatch-board surfaces'));
for(const selector of ['#pending','#active','#units','#detail','.board-group','.row.selected','.cad-hold-chip','dialog'])assert(css.slice(css.indexOf('Day mode v2')).includes(selector),selector+' missing from light theme');
assert(app.includes('i.sharedHold?"Release Hold":"Hold for Unit"'),'no literal interpolation in Hold for Unit label');
console.log('PASS day mode contrast coverage and incident hold button rendering');