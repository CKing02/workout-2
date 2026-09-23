/**
 * G44 — 把 254 个 bundled:false 的 GIF 从 hasaneyldrm GitHub raw 下载到 .tmp/gifs/。
 *
 * 为什么本地没有这 254 张:G41 当初走 CDN 是因为不希望 APKa 体积爆,
 * 把 GIF 拆成 52 bundled + 254 CDN。但 R2 计划一直没真正落地,254 张
 * 从来没被拉下来过 —— 现在 G44 上腾讯云 COS 了,得先把它们下到本地
 * 再上传到 COS。
 *
 * 流程:
 *   1. 从 src/db/seeds/exerciseG35Mapping.ts parse 所有 bundled:false 的 gif basename
 *   2. 从 hasaneyldrm/exercises-dataset GitHub raw 仓库拉对应 .gif
 *   3. 落到 .tmp/gifs/{basename}(已存在且大小合理的跳过)
 *   4. 校验 GIF magic(GIF8...) 防止下载到 HTML 404 页
 *
 * 用法:
 *   node scripts/download-g44-gifs.js           # 全量
 *   node scripts/download-g44-gifs.js --limit=10 # 只下前 10 个测试
 *
 * 完成后:
 *   - .tmp/gifs/ 下应有 254 个 .gif(~25MB)
 *   - 用户在腾讯云 COS 控制台「上传文件」→ 把 .tmp/gifs/ 下所有 .gif 拖进去
 *     (前缀填 exercises/),单次最多 100 张,分 3 批
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';
const TMP_DIR = path.join(__dirname, '..', '.tmp', 'gifs');

const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.slice('--limit='.length), 10) : Infinity;
})();

const CONCURRENCY = 4;     // GitHub raw 限速,8 路并发 ECONNRESET 频繁
const TIMEOUT_MS = 30000;
const RETRY = 5;

// 从 mapping parse 所有 bundled:false 的 gif basename
// regex 加 s flag(ES2018+) 跨行匹配,bundled: false 跟 gifUrl 不一定同一行
const mappingSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'db', 'seeds', 'exerciseG35Mapping.ts'),
  'utf-8',
);
const re = /gifUrl:\s*'videos\/([^']+)',\s*(?:\s|[^}])*?bundled:\s*false/gs;
const items = new Set();
let m;
while ((m = re.exec(mappingSrc)) !== null) {
  items.add(m[1]);
}
const todoAll = [...items];
console.log(`[g44] mapping 找到 ${todoAll.length} 个 bundled:false entry`);

fs.mkdirSync(TMP_DIR, { recursive: true });

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

async function downloadOne(gif) {
  const out = path.join(TMP_DIR, gif);
  // 已存在且 > 1KB 跳过(0 字节是失败残留,1KB 以下是 GIF magic 都不够,重下)
  if (fs.existsSync(out) && fs.statSync(out).size > 1024) {
    return { gif, size: fs.statSync(out).size, skipped: true };
  }
  let lastErr;
  for (let i = 0; i < RETRY; i++) {
    try {
      const buf = await fetchWithTimeout(`${GITHUB_BASE}videos/${gif}`, TIMEOUT_MS);
      if (buf.length < 6 || buf.toString('ascii', 0, 4) !== 'GIF8') {
        throw new Error('not a GIF (bad magic)');
      }
      fs.writeFileSync(out, buf);
      return { gif, size: buf.length };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  const todo = todoAll.slice(0, LIMIT === Infinity ? todoAll.length : LIMIT);
  console.log(`[g44] 计划下载 ${todo.length} 个 GIF`);

  let dlCursor = 0;
  let okCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  let totalBytes = 0;
  const failures = [];

  async function worker() {
    while (dlCursor < todo.length) {
      const idx = dlCursor++;
      const gif = todo[idx];
      try {
        const r = await downloadOne(gif);
        if (r.skipped) skippedCount++;
        else okCount++;
        totalBytes += r.size;
        process.stdout.write(
          `\r[g44] ${idx + 1}/${todo.length} (ok:${okCount} skip:${skippedCount} fail:${failCount}) ${(totalBytes / 1024 / 1024).toFixed(2)} MB    `
        );
      } catch (err) {
        failCount++;
        failures.push({ gif, err: err.message });
        process.stdout.write(
          `\r[g44] ${idx + 1}/${todo.length} (ok:${okCount} skip:${skippedCount} fail:${failCount})    `
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();

  console.log(`[g44] 下载完成:`);
  console.log(`   ✅ 新下载 ${okCount}`);
  console.log(`   ⏭️  已存在跳过 ${skippedCount}`);
  console.log(`   ❌ 失败 ${failCount}`);
  console.log(`   📦 总大小 ${(totalBytes / 1024 / 1024).toFixed(2)} MB → ${TMP_DIR}`);

  if (failures.length > 0) {
    console.error(`\n[g44] ⚠️ 以下 GIF 下载失败:`);
    for (const f of failures) console.error(`   ${f.gif}: ${f.err}`);
    console.error(`[g44] 重跑脚本会自动重试失败的(失败的 0 字节文件 < 1KB 会被重新拉)`);
  }

  if (okCount + skippedCount === todo.length) {
    console.log(`\n✅ 全部 ${todo.length} 个 GIF 已就绪`);
    console.log(`   下一步:`);
    console.log(`   1. 打开腾讯云 COS 控制台 → 进入 workout-gifs-cdn-20260923-...`);
    console.log(`   2. 文件列表 → 上传文件 → 选目录: ${TMP_DIR}`);
    console.log(`   3. 路径前缀填: exercises/`);
    console.log(`   4. 单批 ≤ 100 张,254 张分 3 批`);
    console.log(`   5. 传完告诉我,我替换 mapping URL`);
  }
}

main().catch((err) => {
  console.error('[g44] 致命错误:', err);
  process.exit(1);
});