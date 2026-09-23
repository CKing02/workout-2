/**
 * G41 — 把 250 个 G41 CDN 动作的 GIF 上传到 Cloudflare R2 bucket。
 *
 * 流程:
 *   1. 从 hasaneyldrm GitHub 拉 250 个 GIF(8 路并发,失败自动重试 3 次)
 *   2. PUT 到 R2(S3-compatible,AWS SigV4 signing)
 *   3. 设 cache-control: public, max-age=31536000(GIF 永远不变)
 *   4. 设 content-type: image/gif
 *
 * 用法:
 *   # 先准备 R2 凭证(见 docs/setup/cloudflare-r2.md):
 *   export R2_ACCOUNT_ID="..."
 *   export R2_ACCESS_KEY_ID="..."
 *   export R2_SECRET_ACCESS_KEY="..."
 *   export R2_BUCKET="workout2-gifs"      # 默认 bucket 名
 *   export R2_PUBLIC_URL="https://pub-xxx.r2.dev"
 *
 *   node scripts/upload-g41-r2.js
 *
 *   # 只跑前 10 个测一下:
 *   node scripts/upload-g41-r2.js --limit=10
 *
 *   # 只 dry-run,跳过上传(下载到 ./tmp/g41-gifs/ 验证完整性即可):
 *   node scripts/upload-g41-r2.js --dry-run
 *
 * 完成后:
 *   - R2 bucket 里 250 个文件:`exercises/{id}-{hash}.gif`
 *   - 公开 URL 形如:https://pub-xxx.r2.dev/workout2-gifs/exercises/0151-7xI5MXA.gif
 *   - 把 `pub-xxx` 替换到 src/db/seeds/exerciseG35Mapping.ts 的 cdnUrl 字段
 *     (find-replace `pub-PLACEHOLDER` → `pub-真实ID`)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const http = require('http');

// R2 sigv4 必需
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'workout2-gifs';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev

const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.slice('--limit='.length), 10) : Infinity;
})();
const DRY_RUN = args.includes('--dry-run');

// 从 mapping 抽 250 个 gif basename
// 直接读 raw GitHub 源就行(hasaneyldrm GIF 永远不变)
const GITHUB_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';

// 从 mapping 文件 parse 出所有 bundled:false 的 hasaneyldrmId
const mappingSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'db', 'seeds', 'exerciseG35Mapping.ts'),
  'utf-8',
);
const re = /hasaneyldrmId:\s*'(\d+)',.*?gifUrl:\s*'videos\/([^']+)',\s*bundled:\s*false/g;
const items = [];
let m;
while ((m = re.exec(mappingSrc)) !== null) {
  items.push({ id: m[1], gif: m[2] });
}
console.log(`[g41] mapping 找到 ${items.length} 个 bundled:false entry`);

if (!DRY_RUN && (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL)) {
  console.error('❌ R2 凭证缺失,请设置:');
  console.error('   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL');
  console.error('   (R2_BUCKET 默认 workout2-gifs)');
  console.error('   参考 docs/setup/cloudflare-r2.md');
  process.exit(1);
}

const TMP_DIR = path.join(__dirname, '..', '.tmp', 'g41-gifs');
fs.mkdirSync(TMP_DIR, { recursive: true });

const CONCURRENCY = 8;
const TIMEOUT_MS = 30000;
const RETRY = 3;

function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
  });
}

async function downloadOne(item) {
  const out = path.join(TMP_DIR, item.gif);
  if (fs.existsSync(out) && fs.statSync(out).size > 1024) {
    return { item, skipped: true, size: fs.statSync(out).size };
  }
  let lastErr;
  for (let i = 0; i < RETRY; i++) {
    try {
      const buf = await fetchWithTimeout(`${GITHUB_BASE}videos/${item.gif}`, TIMEOUT_MS);
      // 校验 GIF magic
      if (buf.length < 6 || buf.toString('ascii', 0, 4) !== 'GIF8') {
        throw new Error('not a GIF');
      }
      fs.writeFileSync(out, buf);
      return { item, size: buf.length };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// ---------- S3 SigV4 for R2 ----------
// AWS Signature Version 4 — R2 S3-compatible API
function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function hash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * PUT 单个 GIF 到 R2 bucket,key = `exercises/{gif}`,content-type image/gif,
 * cache-control public,max-age=31536000(GIF 永远不变,激进 cache)。
 */
async function putOne(item, buf) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const key = `exercises/${item.gif}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto'; // R2 uses 'auto'
  const service = 's3';

  const payloadHash = hash(buf);
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    `/${R2_BUCKET}/${key}`,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(Buffer.from(canonicalRequest)),
  ].join('\n');

  const kDate = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        port: 443,
        method: 'PUT',
        path: `/${R2_BUCKET}/${key}`,
        headers: {
          Host: host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          Authorization: authHeader,
          'Content-Type': 'image/gif',
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`PUT ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

// ---------- main ----------
async function main() {
  const todo = items.slice(0, LIMIT === Infinity ? items.length : LIMIT);
  console.log(`[g41] 计划处理 ${todo.length} 个 GIF${DRY_RUN ? '(dry-run)' : ''}`);

  // Step 1: 并发下载到 .tmp
  const dlResults = [];
  let dlCursor = 0;
  async function dlWorker() {
    while (dlCursor < todo.length) {
      const idx = dlCursor++;
      try {
        const r = await downloadOne(todo[idx]);
        dlResults.push(r);
        process.stdout.write(`\r[g41] 下载 ${dlResults.length}/${todo.length} (${r.item.id} ${r.item.gif})`);
      } catch (err) {
        console.error(`\n[g41] 下载失败 ${todo[idx].id} ${todo[idx].gif}: ${err.message}`);
        dlResults.push({ item: todo[idx], error: err });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, dlWorker));
  console.log();
  const okDl = dlResults.filter((r) => !r.error);
  const failDl = dlResults.filter((r) => r.error);
  console.log(`[g41] 下载完成:${okDl.length} 成功,${failDl.length} 失败`);

  if (failDl.length > 0) {
    console.error('[g41] ⚠️ 以下 GIF 下载失败,跳过上传:');
    for (const f of failDl) console.error(`  ${f.item.id} ${f.item.gif}`);
  }

  if (DRY_RUN) {
    console.log('[g41] dry-run 完成,跳过上传');
    return;
  }

  // Step 2: 上传到 R2
  let upOk = 0;
  let upFail = 0;
  let upCursor = 0;
  async function upWorker() {
    while (upCursor < okDl.length) {
      const idx = upCursor++;
      const r = okDl[idx];
      try {
        const buf = fs.readFileSync(path.join(TMP_DIR, r.item.gif));
        await putOne(r.item, buf);
        upOk++;
        process.stdout.write(`\r[g41] 上传 ${upOk}/${okDl.length} (${r.item.id})`);
      } catch (err) {
        upFail++;
        console.error(`\n[g41] 上传失败 ${r.item.id}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, upWorker));
  console.log();
  console.log(`[g41] 上传完成:${upOk} 成功,${upFail} 失败`);

  console.log('');
  console.log('✅ 接下来:');
  console.log(`   1. 验证 R2 公开 URL 可访问(浏览器打开 ${R2_PUBLIC_URL}/workout2-gifs/exercises/${okDl[0]?.item.gif || '0151-7xI5MXA.gif'})`);
  console.log('   2. find-replace 替换 src/db/seeds/exerciseG35Mapping.ts:');
  console.log('        pub-PLACEHOLDER  →  ' + (R2_PUBLIC_URL.match(/pub-([a-z0-9]+)/)?.[1] || 'pub-xxx'));
  console.log('   3. 重跑 jest(应该全绿)');
}

main().catch((err) => {
  console.error('[g41] 致命错误:', err);
  process.exit(1);
});