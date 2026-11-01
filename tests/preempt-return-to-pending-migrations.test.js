const assert=require('node:assert/strict'),fs=require('node:fs');
const standard=fs.readFileSync('migrations/20261101_cad_preempt_returns_unassigned.sql','utf8');
const join=fs.readFileSync('migrations/20261101_cad_preempt_join_unit_on_scene.sql','utf8');
for(const [name,sql] of [['standard PREEMPT',standard],['PREEMPT ON SCENE',join]]){
 assert(sql.includes("then 'ACTIVE' else 'PENDING' end"),name+' must return last-unit source to pending');
 assert(sql.includes('cleared_at is null'),name+' must count only uncleared assignments');
 assert(sql.includes("status='ACTIVE'"),name+' keeps destination active');
 assert(!/delete from public\.cad_incidents/i.test(sql),'preempt never deletes source incident');
 assert(/version=version\+1/.test(sql),name+' must bump version for synced dispatch consoles');
}
console.log('PASS: both forms of PREEMPT return source to pending only after last unit transfers');
