#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat, lstat, readdir, mkdir, writeFile, chmod } from 'node:fs/promises';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataRoot = resolve(root, 'data');
const results = [];
function record(status, name, detail) { results.push({ status, name, detail }); console.log(`${status}: ${name} — ${detail}`); }
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 15000 }); }
async function checkFiles(directory, depth = 0) {
  if (depth > 7) return;
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const item = await lstat(path);
    if (item.isSymbolicLink()) { record('FAIL', 'private symlink', `Symlink found under data/: ${path.slice(root.length + 1)}`); continue; }
    if (item.isDirectory()) { if (item.mode & 0o077) record('WARN', 'directory permissions', `${path.slice(root.length + 1)} is accessible to group/others.`); await checkFiles(path, depth + 1); }
    else if (item.isFile() && item.mode & 0o077) record('WARN', 'private file permissions', `${path.slice(root.length + 1)} is readable/writable by group or others.`);
  }
}
try {
  const version = Number(process.versions.node.split('.')[0]);
  record(version === 24 ? 'PASS' : 'WARN', 'Node runtime', `Node ${process.version}; Echo is developed for Node 24.`);
  try {
    const tracked = git(['ls-files','-z']).split('\0').filter(Boolean);
    const privateTracked = tracked.filter(x => x === '.env' || x.startsWith('data/') && x !== 'data/.gitkeep' || x === 'config/profile.json' || /^training\/.*\.(jsonl|json|pem)$/.test(x) || /(?:^|\/)(?:.*private.*(?:profile|context)|echo-context-seed|.*credential|.*secret).*\.(?:json|md|txt|pem)$/i.test(x));
    record(privateTracked.length ? 'FAIL' : 'PASS', 'Git index privacy', privateTracked.length ? `Private paths tracked: ${privateTracked.join(', ')}` : 'No current private runtime files tracked. Git history not scanned.');
    const ignore = git(['check-ignore','.env','data/echo-context.json','data/training/approved.json']);
    record(ignore.trim().split('\n').length === 3 ? 'PASS' : 'FAIL', 'Git ignore', 'Private files must be ignored by Git.');
  } catch (error) {
    if (/not a git repository/i.test(String(error.stderr || error.message))) record('WARN','Git verification','No repository metadata in this reference copy; run after installing on your cloned Git repository.');
    else record('WARN','Git verification',`Unable to inspect repository: ${String(error.message).slice(0,180)}`);
  }
  await checkFiles(dataRoot);
  const env = resolve(root,'.env');
  try { const s = await stat(env); record(s.mode & 0o077 ? 'WARN' : 'PASS','.env permissions', s.mode & 0o077 ? 'Use chmod 600 .env to restrict access.' : '.env not accessible by group/others.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; record('WARN','.env permissions','No .env found in this environment.'); }
  record('WARN','Dependency vulnerabilities','Run npm audit --omit=dev with internet access; not silently marked passed.');
  record('WARN','Historical Git exposure','Audit earlier commits for historical private data; .gitignore does not erase history.');
  record('WARN','Threat model','Bubblewrap sandbox, multi-device identity and GPU training need independent on-device security review.');
  const report = { version: 1, at: new Date().toISOString(), checks: results, verdict: results.some(x => x.status === 'FAIL') ? 'FAIL' : 'PARTIAL', note: 'PARTIAL is not security certification. Unperformed audit items are explicitly WARN.' };
  await mkdir(dataRoot, { recursive: true, mode: 0o700 });
  const file = join(dataRoot,'echo-security-acceptance.json');
  await writeFile(file, JSON.stringify(report, null, 2), { mode: 0o600 }); await chmod(file, 0o600);
  console.log(`SECURITY VERDICT: ${report.verdict}; report: data/echo-security-acceptance.json`);
  if (report.verdict === 'FAIL') process.exitCode = 1;
} catch (error) { console.error(`SECURITY AUDIT INCOMPLETE: ${error.message}`); process.exitCode = 1; }
