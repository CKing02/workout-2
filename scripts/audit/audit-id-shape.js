// _diag/audit-id-shape.js — 链路 B 验证：training_sets.id 是否曾被 clientId (c_xxx) 串入
const fs = require('fs');
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const ids = [];
for (const grp of (data.trainingSets || [])) for (const s of (grp.sets || [])) ids.push(s.id);

console.log('=== id 前缀分布 ===');
const prefixCount = {};
for (const id of ids) {
  const p = id.slice(0, 2);
  prefixCount[p] = (prefixCount[p] || 0) + 1;
}
for (const [p, c] of Object.entries(prefixCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${JSON.stringify(p)}: ${c}`);
}

console.log('\n=== id 长度分布 ===');
const lenCount = {};
for (const id of ids) lenCount[id.length] = (lenCount[id.length] || 0) + 1;
for (const [l, c] of Object.entries(lenCount).sort((a, b) => a[0] - b[0])) {
  console.log(`  len=${l}: ${c}`);
}

console.log('\n=== c_ 前缀样本 ===');
const cIds = ids.filter(id => id.startsWith('c_'));
console.log(`count: ${cIds.length}`);
cIds.slice(0, 5).forEach(id => console.log(`  ${id}`));

console.log('\n=== UUID 样本（第一个 set 的 id） ===');
if (ids[0]) console.log(`  ${ids[0]}`);
