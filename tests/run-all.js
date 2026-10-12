const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const dir = __dirname;
let failures = 0;
for (const name of readdirSync(dir).filter(n => n.endsWith('.js') && n !== 'run-all.js').sort()) {
  const result = spawnSync(process.execPath, [join(dir, name)], { stdio: 'inherit' });
  if (result.status !== 0) { failures++; console.error(`FAILED: ${name}`); }
}
if (failures) { console.error(`${failures} test script(s) failed`); process.exitCode = 1; }
else console.log('All CAD regression scripts passed.');
