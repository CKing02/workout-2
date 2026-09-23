/**
 * G44 — 批量把 COS bucket 里所有 GIF 的 x-cos-force-download metadata 改成 false。
 *
 * 为什么需要:COS 控制台批量上传文件时会给每个文件打 x-cos-force-download: true,
 * 响应头里就会出现 Content-Disposition: attachment —— 浏览器拿到就走"另存为"流程,
 * 不显示图片。
 *
 * App 客户端不受这个 metadata 影响(RN fetch 拿字节流,自己 Image 渲染),
 * 但浏览器/Web 工具访问就需要修。
 *
 * 安全:
 *  - 凭据从命令行参数或 .tmp/.cos-fix.env 读,不写进代码不写进 git
 *  - 跑完后建议立刻禁用该 API key
 *
 * 用法:
 *   # 方式 1:命令行参数
 *   node scripts/fix-cos-force-download.js --id=AKIDxxx --key=xxx
 *
 *   # 方式 2:环境变量(推荐,从临时文件 source)
 *   echo 'COS_SECRET_ID=AKIDxxx
 *   COS_SECRET_KEY=xxx' > .tmp/.cos-fix.env
 *   ( set -a; source .tmp/.cos-fix.env; set +a; node scripts/fix-cos-force-download.js; rm .tmp/.cos-fix.env )
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argId = args.find((a) => a.startsWith('--id='))?.slice('--id='.length);
const argKey = args.find((a) => a.startsWith('--key='))?.slice('--key='.length);
const SECRET_ID = argId || process.env.COS_SECRET_ID;
const SECRET_KEY = argKey || process.env.COS_SECRET_KEY;

const BUCKET = 'workout-gifs-cdn-20260923-1327489994';
const REGION = 'ap-shanghai';

if (!SECRET_ID || !SECRET_KEY) {
  console.error('❌ 缺凭据,用法:');
  console.error('   node scripts/fix-cos-force-download.js --id=AKIDxxx --key=xxx');
  console.error('   或 设环境变量 COS_SECRET_ID / COS_SECRET_KEY');
  process.exit(1);
}

// SDK 由 npm install --no-save cos-nodejs-sdk-v5 装到 node_modules
const COS = require('cos-nodejs-sdk-v5');
const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY });

function listAllGifs() {
  return new Promise((resolve, reject) => {
    const all = [];
    let marker = undefined;
    function loop() {
      cos.getBucket(
        { Bucket: BUCKET, Region: REGION, Marker: marker, MaxKeys: 1000 },
        (err, data) => {
          if (err) return reject(err);
          all.push(
            ...data.Contents.filter((x) => x.Key.endsWith('.gif')).map((x) => x.Key),
          );
          if (data.IsTruncated === 'true' || data.IsTruncated === true) {
            marker = data.NextMarker;
            loop();
          } else {
            resolve(all);
          }
        },
      );
    }
    loop();
  });
}

/**
 * Copy object to itself, replacing metadata.
 * COS 没有"原地改 metadata"接口,只能用 putObjectCopy(source=self, REPLACED)。
 */
function fixOne(key) {
  return new Promise((resolve, reject) => {
    cos.putObjectCopy(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        CopySource: `${BUCKET}.cos.${REGION}.myqcloud.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
        MetadataDirective: 'Replaced',
        // 自定义 x-cos-* header 在 Metadata 里加;SDK 会处理签名
        xCosForceDownload: 'false',
        // 不改 Cache-Control,保留原始 缓存行为
      },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

async function main() {
  console.log(`[fix] 列出 bucket ${BUCKET} 所有 GIF...`);
  const keys = await listAllGifs();
  console.log(`[fix] 找到 ${keys.length} 个 GIF`);

  let ok = 0;
  let fail = 0;
  const failures = [];
  const CONCURRENCY = 4;

  let cursor = 0;
  async function worker() {
    while (cursor < keys.length) {
      const idx = cursor++;
      const key = keys[idx];
      try {
        await fixOne(key);
        ok++;
        process.stdout.write(`\r[fix] ${ok}/${keys.length} ok, ${fail} fail    `);
      } catch (err) {
        fail++;
        failures.push({ key, err: err.message || String(err) });
        process.stdout.write(`\r[fix] ${ok}/${keys.length} ok, ${fail} fail    `);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();
  console.log(`[fix] 完成: ${ok} 成功, ${fail} 失败`);
  if (failures.length > 0) {
    console.error('[fix] 失败列表:');
    for (const f of failures) console.error(`   ${f.key}: ${f.err}`);
    console.error('[fix] 重跑脚本会重试所有 GIF(已修的会被再 set 一次 false,幂等)');
  }

  console.log('\n[fix] 验证一张响应头(curl -I):');
  const sample = keys[0];
  if (sample) {
    console.log(`   curl -sI "https://${BUCKET}.cos.${REGION}.myqcloud.com/${sample}"`);
    console.log('   应该看不到 Content-Disposition: attachment');
  }

  console.log('\n[fix] ✅ 完成后建议立刻去 CAM 控制台禁用该 API key:');
  console.log('   访问管理 → 用户列表 → g44-cos-fix → API 密钥 → 禁用');
}

main().catch((e) => {
  console.error('[fix] 致命:', e);
  process.exit(1);
});