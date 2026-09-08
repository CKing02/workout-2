/**
 * G37 — 在 G35 32 张 GIF 基础上补 20 张常用动作的 GIF。
 *
 * 用法:node scripts/download-g37-gifs.js
 * 行为同 G35 脚本:8 路并发、跳过已存在、校验 GIF89a magic、一条失败不阻塞。
 *
 * 与 G35 script 的区别:
 *  - ID 列表更短(20 vs 32)
 *  - 输出到同一目录 assets/exercises/(已存在的 32 个会自然 skip)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = require('./audit/exercises-source.json');

const IDS = [
  '0310', '0406', '3287', '0047', '0085', '0095', '0165', '0976',
  '1325', '0993', '1760', '1756', '0103', '2138', '0014', '0012',
  '0070', '0606', '0488', '0024',
];

const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';
const OUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');
const CONCURRENCY = 8;
const TIMEOUT_MS = 30000;

function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

async function downloadOne({ id, gifUrl }) {
  const fileName = path.basename(gifUrl);
  const outPath = path.join(OUT_DIR, fileName);
  if (fs.existsSync(outPath)) {
    return { id, fileName, status: 'skipped (exists)' };
  }
  const url = BASE + gifUrl;
  const buf = await fetchWithTimeout(url, TIMEOUT_MS);
  // 校验 GIF magic GIF87a or GIF89a
  const magic = buf.slice(0, 6).toString('ascii');
  if (magic !== 'GIF87a' && magic !== 'GIF89a') {
    throw new Error(`${fileName} bad magic: ${magic}`);
  }
  fs.writeFileSync(outPath, buf);
  return { id, fileName, status: 'downloaded', size: buf.length };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const tasks = IDS.map((id) => {
    const m = SOURCE.find((d) => d.id === id);
    if (!m) throw new Error(`ID ${id} not in SOURCE`);
    return { id, gifUrl: m.gif_url };
  });

  // 简单并发限流
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        const r = await downloadOne(tasks[i]);
        console.log(`[${r.status}] ${r.id} -> ${r.fileName}${r.size ? ' (' + r.size + ' B)' : ''}`);
        results.push({ ...r, ok: true });
      } catch (e) {
        console.error(`[FAILED] ${tasks[i].id}: ${e.message}`);
        results.push({ id: tasks[i].id, ok: false, err: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nDone. ${ok} ok / ${failed} failed / ${tasks.length} total.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
