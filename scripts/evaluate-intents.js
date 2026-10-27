import { readFile, mkdir, writeFile, rename, rm, chmod } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseIntent } from '../src/core/intent.js';

const corpus = JSON.parse(await readFile(resolve('evaluation/intent-cases.json'), 'utf8'));
const misses = [];
for (const item of corpus) {
  const actual = parseIntent(item.input)?.type ?? null;
  if (actual !== item.intent) misses.push({ input: item.input, expected: item.intent, actual });
}
const passed = corpus.length - misses.length;
const report = { version: 1, at: new Date().toISOString(), total: corpus.length, passed, failed: misses.length, accuracy: passed / corpus.length, scope: 'hand-curated deterministic intent routing only; NOT arbitrary chat accuracy' };
process.stdout.write(`Deterministic routing: ${passed}/${corpus.length} correct (${(report.accuracy * 100).toFixed(1)}%). This is not an LLM factual-accuracy score.\n`);
for (const miss of misses) process.stdout.write(`MISS ${miss.input}: expected=${miss.expected}, actual=${miss.actual}\n`);
const path = resolve('data/echo-quality.json');
await mkdir(dirname(path), { recursive: true, mode: 0o700 });
const temp = `${path}.${randomUUID()}.tmp`;
try {
  await writeFile(temp, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temp, path);
  await chmod(path, 0o600);
} finally { await rm(temp, { force: true }); }
if (misses.length) process.exitCode = 1;
