#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBaseConversion } from '../src/core/number-systems.js';
import { calculateText } from '../src/core/math.js';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const loops = 200;
const elapsed = [];
const before = process.memoryUsage().rss;
for (let i = 0; i < loops; i++) {
  const start = performance.now();
  const result = parseBaseConversion('273 in hexadecimal');
  const binary = calculateText('29+76+19 step by step calculation in binary');
  if (!String(result).includes('111') || !String(binary).includes('124')) throw new Error('Deterministic arithmetic check failed.');
  elapsed.push(performance.now() - start);
}
elapsed.sort((a,b) => a-b);
const p95 = elapsed[Math.ceil(0.95*elapsed.length)-1];
const after = process.memoryUsage().rss;
const maxP95 = Number(process.env.ECHO_DETERMINISTIC_P95_LIMIT_MS ?? 100);
const passed = p95 <= maxP95;
const report = { version: 1, at: new Date().toISOString(), loops, deterministicP95ms: +p95.toFixed(3), thresholdMs: maxP95,
  rssBeforeMiB: +(before/1048576).toFixed(2), rssAfterMiB: +(after/1048576).toFixed(2), passed,
  qualification: 'Measures deterministic arithmetic only on this machine, not Ollama latency, GPU throughput, model accuracy or total application memory.' };
await mkdir(join(root,'data'), { recursive: true, mode: 0o700 });
const file = join(root,'data','echo-performance-acceptance.json');
await writeFile(file, JSON.stringify(report,null,2), { mode: 0o600 });
await chmod(file,0o600);
console.log(`Deterministic p95: ${report.deterministicP95ms} ms (limit ${maxP95} ms); RSS: ${report.rssBeforeMiB}→${report.rssAfterMiB} MiB; ${passed?'PASS':'FAIL'}`);
console.log('Real Ollama CPU + RAM + response latency require a separate on-device benchmark with the configured model.');
if (!passed) process.exitCode = 1;
