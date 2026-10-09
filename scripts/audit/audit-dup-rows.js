// 用法: node _diag/audit-dup-rows.js <path-to-backup.json>
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node audit-dup-rows.js <backup.json>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('=== 0. 数据概览 ===');
console.log('top-level keys:', Object.keys(data));
console.log('trainingSets groups:', data.trainingSets?.length ?? 'N/A');
console.log('trainings:', data.trainings?.length ?? 'N/A');
console.log('planExercises:', data.planExercises?.length ?? 'N/A');
console.log('plans:', data.plans?.length ?? 'N/A');
console.log('exercises:', data.exercises?.length ?? 'N/A');
console.log('errorLogs:', data.errorLogs?.length ?? 'N/A');

console.log('\n=== 1. training_sets.id 重复检测 ===');
const setIds = [];
for (const grp of (data.trainingSets || [])) {
  for (const s of (grp.sets || [])) setIds.push(s.id);
}
const dupMap = {};
for (const id of setIds) dupMap[id] = (dupMap[id] || 0) + 1;
const dups = Object.entries(dupMap).filter(([, c]) => c > 1);
console.log(`total sets: ${setIds.length}, unique: ${new Set(setIds).size}, dup keys: ${dups.length}`);
for (const [id, count] of dups) {
  const occurrences = (data.trainingSets || [])
    .filter(g => (g.sets || []).some(s => s.id === id))
    .map(g => g.trainingId);
  console.log(`  ${id}: count=${count} trainings=${JSON.stringify(occurrences)}`);
}

console.log('\n=== 2. plan_exercises 重复行 (per planId+exerciseId) ===');
const peCount = {};
for (const pe of (data.planExercises || [])) {
  const k = `${pe.planId}|${pe.exerciseId}`;
  peCount[k] = (peCount[k] || 0) + 1;
}
const peDup = Object.entries(peCount).filter(([, c]) => c > 1);
console.log(`total plan_exercises: ${(data.planExercises || []).length}, dup (planId+exerciseId): ${peDup.length}`);
for (const [k, c] of peDup) console.log(`  ${k}: count=${c}`);

console.log('\n=== 3. trainings.id 重复 (SQL 主键) ===');
const trainIds = (data.trainings || []).map(t => t.id);
const trainDup = trainIds.filter((v, i) => trainIds.indexOf(v) !== i);
console.log(`total trainings: ${trainIds.length}, unique: ${new Set(trainIds).size}, dup: ${trainDup.length}`);

console.log('\n=== 4. 按 training_id 聚合 set,看哪些 training 有重复 set.id ===');
const byTraining = {};
for (const grp of (data.trainingSets || [])) {
  byTraining[grp.trainingId] = grp.sets || [];
}
let any = false;
for (const [tid, sets] of Object.entries(byTraining)) {
  const ids = sets.map(s => s.id);
  if (new Set(ids).size !== ids.length) {
    any = true;
    console.log(`  training ${tid}: ${ids.length} sets, ${new Set(ids).size} unique — 内部有重复`);
  }
}
if (!any) console.log('  (无) 所有 training 内部 set.id 都唯一');

console.log('\n=== 5. exercises.id 重复 (参考) ===');
const exIds = (data.exercises || []).map(e => e.id);
const exDup = exIds.filter((v, i) => exIds.indexOf(v) !== i);
console.log(`total exercises: ${exIds.length}, unique: ${new Set(exIds).size}, dup: ${exDup.length}`);

console.log('\n=== 6. plans.id 重复 (参考) ===');
const plIds = (data.plans || []).map(p => p.id);
const plDup = plIds.filter((v, i) => plIds.indexOf(v) !== i);
console.log(`total plans: ${plIds.length}, unique: ${new Set(plIds).size}, dup: ${plDup.length}`);
