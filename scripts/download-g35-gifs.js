/**
 * G35 §2 — 把 32 张 GIF 从 hasaneyldrm/exercises-dataset 下到 assets/exercises/
 *
 * 用法:node scripts/download-g35-gifs.js
 * 输出:assets/exercises/{hasaneyldrm-id}-{slug}.gif(沿用 0293 那张的命名风格)
 * 特性:
 *  - 8 路并发(同源 GitHub raw 单连接 100+KB/s;并发把 32 张压到 1-2 分钟)
 *  - 跳过已存在文件(二次运行 no-op)
 *  - 校验:GIF89a/87a magic
 *  - 一条失败不阻塞其它
 *
 * slug 用 hasaneyldrm 英文名 kebab-case 化,而不是我自己起的别名 —
 * 跟仓库里的命名风格保持一致,日后查 / 删方便。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 直接读 exercises-source.json 拿 gif_url,再读 mapping 文件拿 seedName + hasaneyldrmName
// (mapping 文件是 .ts,require 不了,所以这里反查源数据拼 slug)
const SOURCE = require('./audit/exercises-source.json');

const MAPPING = [
  ['杠铃卧推',      '0025'],
  ['哑铃卧推',      '0289'],
  ['哑铃飞鸟',      '0308'],
  ['上斜哑铃推举',  '0314'],
  ['器械夹胸',      '0596'],
  ['龙门架夹胸',    '0188'],
  ['引体向上',      '0652'],
  ['高位下拉',      '2330'],
  ['杠铃划船',      '0027'],
  ['哑铃单臂划船',  '0292'],
  ['坐姿绳索划船',  '0861'],
  ['杠铃推举',      '0091'],
  ['哑铃侧平举',    '0334'],
  ['俯身飞鸟',      '0383'],
  ['绳索面拉',      '0203'],
  ['杠铃弯举',      '0031'],
  ['哑铃弯举',      '0285'],
  ['三头下压',      '0241'],
  ['仰卧臂屈伸',    '0061'],
  ['深蹲',          '0043'],
  ['硬拉',          '0032'],
  ['腿推',          '2287'],
  ['腿屈伸',        '0585'],
  ['腿弯举',        '0586'],
  ['弓步蹲',        '0336'],
  ['站姿提踵',      '1373'],
  ['坐姿提踵',      '1379'],
  ['平板支撑',      '0464'],
  ['卷腹',          '0274'],
  ['悬垂举腿',      '0472'],
  ['壶铃摇摆',      '0549'],
  ['跑步机慢跑',    '3666'],
];

const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';
const OUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');
const CONCURRENCY = 8;
const TIMEOUT_MS = 30000;

function toSlug(enName) {
  return enName
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

async function downloadOne({ id, gifUrl, slug }) {
  const fileName = path.basename(gifUrl); // e.g. 0025-EIeI8Vf.gif
  const outPath = path.join(OUT_DIR, fileName);
  if (fs.existsSync(outPath)) {
    const size = fs.statSync(outPath).size;
    return { id, slug, fileName, skipped: true, bytes: size };
  }
  const buf = await fetchWithTimeout(BASE + gifUrl, TIMEOUT_MS);
  const magic = buf.slice(0, 6).toString('ascii');
  if (!magic.startsWith('GIF8')) {
    throw new Error(`not a GIF (magic=${magic})`);
  }
  fs.writeFileSync(outPath, buf);
  return { id, slug, fileName, skipped: false, bytes: buf.length };
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    try {
      results.push(await worker(items[idx]));
      process.stdout.write('.');
    } catch (err) {
      results.push({ id: items[idx].id, slug: items[idx].slug, error: err.message });
      process.stdout.write('x');
    }
    if (((idx + 1) % 8) === 0) process.stdout.write('\n');
    return next();
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
  return results;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = MAPPING.map(([seedName, id]) => {
    const rec = SOURCE.find((d) => d.id === id);
    if (!rec) throw new Error(`no source record for id ${id}`);
    return {
      id,
      seedName,
      gifUrl: rec.gif_url,
      slug: toSlug(rec.name),
    };
  });
  console.log(`downloading ${items.length} GIFs to ${OUT_DIR} (concurrency=${CONCURRENCY})`);
  const t0 = Date.now();
  const results = await runPool(items, downloadOne, CONCURRENCY);
  const ms = Date.now() - t0;
  console.log(`\n--- done in ${(ms / 1000).toFixed(1)}s ---`);

  let downloaded = 0, skipped = 0, failed = 0, totalBytes = 0;
  for (const r of results) {
    if (r.error) {
      failed++;
      console.log(`  ✗ ${r.id} (${r.slug}) — ${r.error}`);
    } else if (r.skipped) {
      skipped++;
    } else {
      downloaded++;
      totalBytes += r.bytes;
      console.log(`  ✓ ${r.fileName} (${(r.bytes / 1024).toFixed(1)} KB)`);
    }
  }
  console.log(`downloaded: ${downloaded} (${(totalBytes / 1024).toFixed(1)} KB new)`);
  console.log(`skipped:    ${skipped}`);
  console.log(`failed:     ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });