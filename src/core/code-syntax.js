import { spawnSync } from 'node:child_process';

export function checkJavascriptSyntax(source, { nodePath = process.execPath } = {}) {
  if (typeof source !== 'string' || source.length > 100_000) throw new Error('JavaScript source must be at most 100 KB.');
  const run = spawnSync(nodePath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024, env: { PATH: process.env.PATH || '/usr/bin:/bin' } });
  if (run.error) return { valid: false, output: `Syntax check unavailable: ${run.error.code || run.error.message}` };
  if (run.status === 0) return { valid: true, output: 'JavaScript parser accepted this source. This checks syntax ONLY; it does not run the program, verify logic, or establish security.' };
  return { valid: false, output: `JavaScript syntax error (no code executed):\n${String(run.stderr || run.stdout || 'Unknown syntax error').slice(0, 1500)}` };
}
