import { randomBytes } from 'node:crypto';
import { mkdir, lstat, readFile, readdir, open, rename, rm, stat } from 'node:fs/promises';
import { resolve, join, dirname, sep, posix } from 'node:path';
import { checkJavascriptSyntax } from './code-syntax.js';

const EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.c', '.h', '.py']);
const MAX_BYTES = 48 * 1024;
const MAX_TOTAL = 128 * 1024;

export function cleanFilename(name) {
  if (typeof name !== 'string' || !name || name.length > 128 || name.includes('\\') || name.includes('\0')) throw new Error('Invalid filename.');
  const parts = name.split('/');
  if (parts.length > 3 || parts.some(p => !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,70}$/.test(p) || p === '.' || p === '..' || p.startsWith('.'))) throw new Error('Use simple relative filenames without dotfiles or traversal; at most two directory levels.');
  const ext = posix.extname(name).toLowerCase();
  if (!EXTENSIONS.has(ext)) throw new Error('Allowed extensions: .js, .mjs, .html, .css, .json, .md, .txt, .c, .h, .py.');
  return name;
}

function validateContents(name, content) {
  if (typeof content !== 'string' || !content.trim() || content.includes('\0') || Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new Error('File content must be nonempty UTF-8 and no larger than 48 KiB.');
  const ext = posix.extname(name).toLowerCase();
  if (ext === '.js' || ext === '.mjs') {
    const result = checkJavascriptSyntax(content);
    if (!result.valid) throw new Error(`Cannot stage invalid JavaScript in ${name}: ${result.output}`);
    return 'JavaScript syntax checked; runtime behavior and safety are NOT verified.';
  }
  if (ext === '.json') {
    try { JSON.parse(content); } catch (error) { throw new Error(`Cannot stage invalid JSON in ${name}: ${error.message}`); }
    return 'JSON syntax checked; schema and meaning are NOT verified.';
  }
  return 'Content stored as text; semantic correctness is NOT verified.';
}

export function extractCodeBlock(answer, index = 1) {
  if (!Number.isInteger(index) || index < 1 || index > 20) throw new Error('Code block index must be between 1 and 20.');
  const matches = [...String(answer).matchAll(/```[^\n]*\n([\s\S]*?)\n?```/g)];
  if (!matches.length) throw new Error('The previous answer contains no fenced code blocks. Nothing was saved.');
  if (index > matches.length) throw new Error(`Only ${matches.length} fenced code block(s) available.`);
  return { code: matches[index - 1][1].trimEnd() + '\n', count: matches.length };
}

export class FileWorkspace {
  constructor({ root, clock = () => Date.now() } = {}) {
    if (!root) throw new Error('A private workspace root is required.');
    this.root = resolve(root);
    this.clock = clock;
    this.drafts = new Map();
  }
  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Workspace root cannot be a symlink.');
    return this;
  }
  async safeParent(name, { create = false } = {}) {
    cleanFilename(name);
    await this.init();
    let current = this.root;
    for (const part of name.split('/').slice(0, -1)) {
      current = join(current, part);
      const info = await lstat(current).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
      if (!info) {
        if (!create) return null;
        await mkdir(current, { mode: 0o700 });
      } else if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Workspace path contains a non-directory or symbolic link.');
    }
    return current;
  }
  async ensureAbsent(name) {
    const parent = await this.safeParent(name);
    if (!parent) return;
    const info = await lstat(join(parent, posix.basename(name))).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (info) throw new Error(`File ${name} already exists. Echo refuses to overwrite existing files.`);
  }
  async stage(files) {
    if (!Array.isArray(files) || !files.length || files.length > 8) throw new Error('A draft contains between 1 and 8 files.');
    const unique = new Set();
    let total = 0;
    const prepared = [];
    for (const item of files) {
      const name = cleanFilename(item.name);
      if (unique.has(name.toLowerCase())) throw new Error('Duplicate filenames in draft.');
      unique.add(name.toLowerCase());
      const verification = validateContents(name, item.content);
      total += Buffer.byteLength(item.content, 'utf8');
      if (total > MAX_TOTAL) throw new Error('Draft exceeds 128 KiB.');
      await this.ensureAbsent(name);
      prepared.push({ name, content: item.content, verification });
    }
    for (const [id, d] of this.drafts) if (this.clock() - d.created > 15 * 60_000) this.drafts.delete(id);
    if (this.drafts.size >= 8) throw new Error('Too many pending drafts; cancel or save one first.');
    const id = randomBytes(5).toString('hex');
    this.drafts.set(id, { files: prepared, created: this.clock() });
    return { id, files: prepared.map(({ name, verification }) => ({ name, verification })) };
  }
  get(id) {
    const item = this.drafts.get(id);
    if (!item) throw new Error(`Draft ${id} not found. Drafts are session-only; create it again if Echo restarted.`);
    if (this.clock() - item.created > 15 * 60_000) { this.drafts.delete(id); throw new Error('Draft expired after 15 minutes. No file was written.'); }
    return item;
  }
  preview(id) {
    const draft = this.get(id);
    return draft.files.map(f => `${f.name}: ${Buffer.byteLength(f.content, 'utf8')} bytes. ${f.verification}\n${f.content.slice(0, 2000)}${f.content.length > 2000 ? '\n[Preview truncated]' : ''}`).join('\n\n');
  }
  cancel(id) { this.get(id); this.drafts.delete(id); }
  async save(id) {
    const draft = this.get(id);
    for (const f of draft.files) await this.ensureAbsent(f.name);
    const created = [];
    try {
      for (const f of draft.files) {
        const parent = await this.safeParent(f.name, { create: true });
        const full = join(parent, posix.basename(f.name));
        const handle = await open(full, 'wx', 0o600);
        created.push(full);
        try { await handle.writeFile(f.content, 'utf8'); } finally { await handle.close(); }
      }
    } catch (error) {
      await Promise.allSettled(created.map(path => rm(path, { force: true })));
      throw new Error(`No files committed. Writing failed: ${error.message}`);
    }
    this.drafts.delete(id);
    return draft.files.map(f => f.name);
  }
  async read(name) {
    const clean = cleanFilename(name);
    const parent = await this.safeParent(clean);
    if (!parent) throw new Error('File not found in private workspace.');
    const full = join(parent, posix.basename(clean));
    const info = await lstat(full);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES) throw new Error('Only regular private workspace files up to 48 KiB can be read.');
    return readFile(full, 'utf8');
  }
  async list() {
    await this.init();
    const out = [];
    const walk = async (dir, prefix = '') => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory() && relative.split('/').length <= 2) await walk(join(dir, entry.name), relative + '/');
        else if (entry.isFile() && EXTENSIONS.has(posix.extname(relative).toLowerCase())) out.push(relative);
      }
    };
    await walk(this.root);
    return out.sort();
  }
}
