// Test helper (not part of the prototype): runs as spikeuser and starts a set of launcher processes
// as close together as possible, then records spawn time, exit time and exit code of each.
// Usage: resellr-node.exe spawn-set.mjs <config.json>
// config: { exe, out, waitMs, items: [{ name, args, env?, delayMs? }] }
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t0 = Date.now();
const results = [];

for (const item of config.items) {
  const wait = t0 + (item.delayMs ?? 0) - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const result = { name: item.name, args: item.args, pid: null, spawnTs: Date.now(), exitTs: null, code: null, error: null };
  const child = spawn(config.exe, item.args, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...(item.env ?? {}) },
  });
  result.pid = child.pid ?? null;
  child.on('exit', (code) => {
    result.exitTs = Date.now();
    result.code = code;
  });
  child.on('error', (err) => {
    result.error = err.message;
  });
  results.push(result);
}
fs.writeFileSync(`${config.out}.spawned.json`, JSON.stringify({ t0, results }, null, 2));

const deadline = t0 + config.waitMs;
while (Date.now() < deadline && results.some((r) => r.exitTs === null && r.error === null)) {
  await new Promise((resolve) => setTimeout(resolve, 50));
}
fs.writeFileSync(config.out, JSON.stringify({ t0, results }, null, 2));
process.exit(0);
