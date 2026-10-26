/**
 * G56 — bundle the newly-added Smith-machine and kneeling exercise GIFs.
 * Run with: node scripts/download-g56-gifs.js
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const SOURCE = require('./audit/exercises-source.json');
const IDS = [
  '0748', '0757', '1359', '0765', '0770', '0752', '0755', '0768', '0773',
  '0983', '0167', '0175', '3697', '0176', '1771', '3211', '1346',
];
const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/';
const OUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');

function fetchBuffer(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(fetchBuffer(res.headers.location, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout for ${url}`)));
    req.on('error', reject);
  });
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fetchBuffer(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const id of IDS) {
    const source = SOURCE.find((item) => item.id === id);
    if (!source) throw new Error(`Missing source record ${id}`);
    const fileName = path.basename(source.gif_url);
    const output = path.join(OUT_DIR, fileName);
    if (fs.existsSync(output)) {
      console.log(`[exists] ${fileName}`);
      continue;
    }
    const buffer = await fetchWithRetry(BASE + source.gif_url);
    const magic = buffer.subarray(0, 6).toString('ascii');
    if (magic !== 'GIF87a' && magic !== 'GIF89a') {
      throw new Error(`${fileName} is not a GIF (${magic})`);
    }
    fs.writeFileSync(output, buffer);
    console.log(`[downloaded] ${fileName} (${buffer.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
