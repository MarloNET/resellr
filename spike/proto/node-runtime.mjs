// Downloads node-v<version>-win-x64.zip from nodejs.org, verifies it against SHASUMS256.txt
// and extracts node.exe. Usage: node node-runtime.mjs <version, e.g. v26.13.0> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [version, outDir] = process.argv.slice(2);
if (!/^v\d+\.\d+\.\d+$/.test(version ?? '') || !outDir) {
  console.error('usage: node node-runtime.mjs <vX.Y.Z> <outDir>');
  process.exit(2);
}

const base = `https://nodejs.org/dist/${version}`;
const zipName = `node-${version}-win-x64.zip`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const shasums = (await download(`${base}/SHASUMS256.txt`)).toString('utf8');
const expected = shasums
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .find(([, name]) => name === zipName)?.[0];
if (!expected) throw new Error(`${zipName} not listed in SHASUMS256.txt`);

const zip = await download(`${base}/${zipName}`);
const actual = crypto.createHash('sha256').update(zip).digest('hex');
if (actual !== expected) throw new Error(`SHA-256 mismatch for ${zipName}: expected ${expected}, got ${actual}`);

const zipFile = path.join(outDir, zipName);
fs.writeFileSync(zipFile, zip);
const entry = `node-${version}-win-x64/node.exe`;
execFileSync('tar', ['-xf', zipFile, '-C', outDir, entry], { stdio: 'inherit' });
fs.copyFileSync(path.join(outDir, entry), path.join(outDir, 'node.exe'));

const report = { version, zipName, sha256: actual, sha256Verified: true, downloadMs: Date.now() - t0 };
fs.writeFileSync(path.join(outDir, 'node-runtime.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
