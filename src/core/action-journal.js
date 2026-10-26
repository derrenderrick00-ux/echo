import { mkdir, readFile, rename, rm, writeFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const VALID_TYPES = new Set(['delete-note', 'delete-task', 'trust-device', 'import-snapshot', 'add-task']);
const MAX_PENDING = 40;
const MAX_AUDIT = 300;

export class ActionJournal {
  constructor({ filePath, clock = () => new Date() }) {
    this.filePath = filePath;
    this.clock = clock;
    this.data = { version: 1, pending: [], audit: [] };
  }

  async init() {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (data?.version !== 1 || !Array.isArray(data.pending) || !Array.isArray(data.audit)) throw new Error('Invalid action journal schema.');
      if (data.pending.length > MAX_PENDING || data.audit.length > MAX_AUDIT) throw new Error('Action journal capacity exceeded.');
      for (const item of data.pending) {
        if (!VALID_TYPES.has(item.type) || !/^[0-9a-f]{8}$/.test(item.id) || typeof item.summary !== 'string' || typeof item.createdAt !== 'string' || typeof item.payload !== 'object' || !item.payload) throw new Error('Invalid pending action.');
      }
      this.data = data;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Action journal cannot be opened safely: ${error.message}`);
    }
    return this;
  }

  async persist() {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const temp = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(this.data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      await rename(temp, this.filePath);
      await chmod(this.filePath, 0o600);
    } finally { await rm(temp, { force: true }); }
  }

  list() { return this.data.pending.map(({ id, summary, type, createdAt }) => ({ id, summary, type, createdAt })); }
  audit() { return this.data.audit.slice(-20).map(x => ({ ...x })); }

  async propose(type, summary, payload) {
    if (!VALID_TYPES.has(type)) throw new Error('This type of action is not permitted.');
    if (this.data.pending.length >= MAX_PENDING) throw new Error('Too many pending actions; approve or reject one first.');
    if (!summary || summary.length > 250) throw new Error('Invalid action summary.');
    const id = randomUUID().slice(0, 8);
    const item = { id, type, summary, payload, createdAt: this.clock().toISOString() };
    this.data.pending.push(item);
    await this.persist();
    return this.list().find(x => x.id === id);
  }

  async finalize(id, status, detail = '') {
    const index = this.data.pending.findIndex(x => x.id === id);
    if (index < 0) throw new Error(`Pending action [${id}] not found. Use /actions.`);
    if (!['approved', 'rejected', 'expired'].includes(status)) throw new Error('Invalid action decision.');
    const [item] = this.data.pending.splice(index, 1);
    this.data.audit.push({ id, type: item.type, summary: item.summary, status, detail: String(detail).slice(0, 180), at: this.clock().toISOString() });
    this.data.audit = this.data.audit.slice(-MAX_AUDIT);
    await this.persist();
    return item;
  }

  get(id) { return this.data.pending.find(x => x.id === id); }
  isExpired(item) { return this.clock().getTime() - Date.parse(item.createdAt) > 15 * 60 * 1000; }
}
