import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { basename, join, resolve, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

const VALID_FILE = /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,80}\.m?js$/;

export function sandboxArgs({ sourceFile, nodeExecutable = process.execPath }) {
  const args = ['--unshare-all', '--die-with-parent', '--new-session', '--clearenv', '--setenv', 'HOME', '/tmp', '--setenv', 'PATH', '/usr/bin:/bin'];
  for (const dir of ['/usr', '/lib', '/lib64', '/bin']) if (existsSync(dir)) args.push('--ro-bind', dir, dir);
  args.push('--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/work', '--dir', '/runtime');
  args.push('--ro-bind', realpathSync(nodeExecutable), '/runtime/node');
  args.push('--ro-bind', sourceFile, '/work/program.mjs');
  args.push('--chdir', '/work', '/runtime/node', '--no-addons', '--max-old-space-size=64', '/work/program.mjs');
  return args;
}

export class CodeSandbox {
  constructor({ workspaceDir, runner = spawn, probe = spawnSync, runtime = process.execPath, timeoutMs = 4000, maxOutputBytes = 16384, enabled = false }) {
    if (!workspaceDir) throw new Error('A private code workspace is required.');
    this.workspaceDir = workspaceDir;
    this.runner = runner;
    this.probe = probe;
    this.runtime = runtime;
    this.timeoutMs = timeoutMs;
    this.maxOutputBytes = maxOutputBytes;
    this.enabled = enabled;
  }
  async init() { await mkdir(this.workspaceDir, { recursive: true, mode: 0o700 }); return this; }
  inspect() {
    if (!this.enabled) return { ready: false, detail: 'Experimental sandbox execution is OFF. Code generation, explanation and review remain available. Do not enable untrusted-code execution until the local isolation security and Ubuntu updates have been reviewed.' };
    const report = this.probe('bwrap', ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (report.error || report.status !== 0) return { ready: false, detail: 'bubblewrap (bwrap) not available. Install with: sudo apt install bubblewrap. Execution remains disabled.' };
    return { ready: true, detail: 'bubblewrap found. Actual user-namespace capability is verified on each run; failure will not fall back to host execution.' };
  }
  async listFiles() {
    await this.init();
    const { readdir } = await import('node:fs/promises');
    const result = [];
    for (const name of await readdir(this.workspaceDir)) {
      if (!VALID_FILE.test(name)) continue;
      const path = join(this.workspaceDir, name);
      const details = await stat(path).catch(() => null);
      if (details?.isFile() && details.size <= 16384) result.push({ name, size: details.size });
    }
    return result;
  }
  async source(file) {
    if (!VALID_FILE.test(String(file))) throw new Error('Use a .js or .mjs filename directly inside data/code-workspace; subdirectories and path traversal are not allowed.');
    await this.init();
    const root = await realpath(this.workspaceDir);
    const path = resolve(root, file);
    if (!path.startsWith(root + sep) || basename(path) !== file) throw new Error('File must be inside the private code workspace.');
    const actual = await realpath(path);
    if (!actual.startsWith(root + sep)) throw new Error('Symbolic links outside the code workspace are forbidden.');
    const info = await stat(actual);
    if (!info.isFile() || info.size > 16384) throw new Error('Only regular JavaScript files up to 16 KiB are allowed.');
    const content = await readFile(actual, 'utf8');
    if (content.includes('\0')) throw new Error('Binary input is not accepted.');
    return { path: actual, content };
  }
  async run(file) {
    const { path } = await this.source(file);
    const status = this.inspect();
    if (!status.ready) throw new Error(status.detail);
    const args = sandboxArgs({ sourceFile: path, nodeExecutable: this.runtime });
    return new Promise((resolve, reject) => {
      let done = false, child, out = '', err = '';
      const settle = (failure, result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (failure) reject(failure);
        else resolve(result);
      };
      try { child = this.runner('bwrap', args, { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH || '/usr/bin:/bin' }, detached: true }); }
      catch (error) { reject(new Error(`Isolated runner failed to start: ${error.message}`)); return; }
      const kill = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { } } };
      const timer = setTimeout(() => { kill(); settle(new Error(`Sandbox exceeded ${this.timeoutMs} ms execution limit.`)); }, this.timeoutMs);
      const collect = (which, chunk) => {
        const text = chunk.toString('utf8');
        if (which === 'out') out += text;
        else err += text;
        if (Buffer.byteLength(out) + Buffer.byteLength(err) > this.maxOutputBytes) {
          kill();
          settle(new Error('Sandbox produced too much output and was stopped.'));
        }
      };
      child.stdout?.on('data', chunk => collect('out', chunk));
      child.stderr?.on('data', chunk => collect('err', chunk));
      child.once('error', error => settle(new Error(`Isolated runner could not start: ${error.message}`)));
      child.once('close', (code, signal) => {
        if (done) return;
        if (code !== 0 && /user namespace|operation not permitted|permission denied|creating new namespace/i.test(err)) {
          settle(new Error('Bubblewrap isolation is blocked by this Linux configuration. Code was NOT run directly on the host.'));
          return;
        }
        settle(null, { exitCode: code, signal, stdout: out, stderr: err, isolated: true });
      });
    });
  }
}
