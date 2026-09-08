/**
 * G37 retry — 3 张 ECONNRESET 失败的 GIF 单独重试,带指数退避。
 * 与主 download 脚本分离,便于失败后再跑。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = require('./audit/exercises-source.json');
const FAILED_IDS = ['0310', '0976', '0165'];
const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';
const OUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');

function fetchWithRetry(url, timeoutMs, maxRetries = 6) {
  let attempt = 0;
  let lastErr;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      attempt++;
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          lastErr = new Error(`HTTP ${res.statusCode}`);
          return doneMaybe();
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => { lastErr = e; doneMaybe(); });
    };
    const doneMaybe = () => {
      if (attempt >= maxRetries) return reject(lastErr);
      setTimeout(tryOnce, 800 * attempt);
    };
    tryOnce();
  });
}

(async () => {
  for (const id of FAILED_IDS) {
    const m = SOURCE.find((d) => d.id === id);
    if (!m) { console.log('skip (not in source) ' + id); continue; }
    const fileName = path.basename(m.gif_url);
    const outPath = path.join(OUT_DIR, fileName);
    if (fs.existsSync(outPath)) {
      console.log('[exists] ' + fileName);
      continue;
    }
    try {
      const buf = await fetchWithRetry(BASE + m.gif_url, 30000);
      const magic = buf.slice(0, 6).toString('ascii');
      if (magic !== 'GIF87a' && magic !== 'GIF89a') throw new Error('bad magic ' + magic);
      fs.writeFileSync(outPath, buf);
      console.log('[downloaded] ' + fileName + ' (' + buf.length + ' B)');
    } catch (e) {
      console.error('[FAILED] ' + id + ': ' + e.message);
    }
  }
  console.log('done');
})();
