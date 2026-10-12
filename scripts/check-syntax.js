const { readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = join(__dirname, '..');
const excluded = new Set(['node_modules', '.git', '.netlify', 'dist', 'coverage']);
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    if (excluded.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.js') ? [path] : [];
  });
}
let failures = 0;
for (const path of walk(root)) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures++;
    console.error(relative(root, path) + ': ' + (result.stderr || 'syntax check failed'));
  }
}
if (failures) process.exitCode = 1;
else console.log('JavaScript syntax validated across ' + walk(root).length + ' files.');
