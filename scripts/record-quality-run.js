import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, rename, rm, chmod } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const run = spawnSync(process.execPath, ['--test'], { cwd: resolve('.'), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 120000, env: { ...process.env, ECHO_TEST_RECORDING: '1' } });
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
const summary = key => {
  const matches = [...(run.stdout || '').matchAll(new RegExp(`^[\\sℹ#]*${key}\\s+(\\d+)\\s*$`, 'gm'))];
  return matches.length ? Number(matches.at(-1)[1]) : null;
};
const passed = summary('pass');
const failed = summary('fail');
const total = summary('tests');
const ok = run.status === 0 && passed !== null && failed === 0 && total === passed;
const report = { version: 1, at: new Date().toISOString(), passed: passed ?? 0, failed: failed ?? (run.status === 0 ? 0 : 1), total: total ?? 0, ok, source: 'node --test (local machine)' };
const path = resolve('data/echo-test-report.json');
await mkdir(dirname(path), { recursive: true, mode: 0o700 });
const temporary = `${path}.${randomUUID()}.tmp`;
try {
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, path);
  await chmod(path, 0o600);
} finally { await rm(temporary, { force: true }); }
process.stdout.write(`Recorded verified test summary privately to data/echo-test-report.json: ${report.passed}/${report.total} passed, ${report.failed} failed.\n`);
process.exitCode = ok ? 0 : 1;
