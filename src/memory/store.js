import { mkdir, readFile, rename, rm, writeFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const EMPTY = () => ({ version: 1, notes: [], tasks: [] });
const MAX_NOTES = 500;
const MAX_TASKS = 300;

function tokenize(input) {
  return new Set(String(input).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.+#-]*/gu)?.filter(w => w.length >= 3) ?? []);
}

function overlap(query, text) {
  const q = tokenize(query);
  const t = tokenize(text);
  if (!q.size) return 0;
  return [...q].filter(w => t.has(w)).length / q.size;
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.tasks)) {
    throw new Error('Unsupported or corrupted memory file. Back it up before repairing it.');
  }
  if (data.notes.length > MAX_NOTES || data.tasks.length > MAX_TASKS) {
    throw new Error('Memory file exceeds Phase 0 limits.');
  }
  for (const note of data.notes) {
    if (typeof note.id !== 'string' || typeof note.text !== 'string' || typeof note.createdAt !== 'string') {
      throw new Error('Memory file contains an invalid note.');
    }
  }
  for (const task of data.tasks) {
    if (typeof task.id !== 'string' || typeof task.text !== 'string' || typeof task.done !== 'boolean') {
      throw new Error('Memory file contains an invalid task.');
    }
  }
  return data;
}

function normalizeTask(text) {
  return String(text).toLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:complete|finish|finished|study|learn|review|revise)\s+/, '');
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[b.length];
}

export class MemoryStore {
  constructor({ filePath, embedder = null, clock = () => new Date() }) {
    if (!filePath) throw new Error('A memory file path is required.');
    this.filePath = filePath;
    this.embedder = embedder;
    this.clock = clock;
    this.data = EMPTY();
    this.ready = false;
  }

  async init() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = validate(JSON.parse(raw));
    } catch (error) {
      if (error.code === 'ENOENT') this.data = EMPTY();
      else if (error instanceof SyntaxError) throw new Error('Memory file contains invalid JSON. Back it up before editing.');
      else throw error;
    }
    this.ready = true;
    return this;
  }

  checkReady() {
    if (!this.ready) throw new Error('Memory store has not been initialized.');
  }

  async save() {
    this.checkReady();
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  listNotes() {
    this.checkReady();
    return this.data.notes.map(({ id, text, createdAt }) => ({ id, text, createdAt }));
  }

  async addNote(text) {
    this.checkReady();
    const clean = String(text).trim();
    if (!clean || clean.length > 1500) throw new Error('Note must be between 1 and 1,500 characters.');
    if (this.data.notes.length >= MAX_NOTES) throw new Error('Maximum note count reached.');
    const note = { id: randomUUID().slice(0, 8), text: clean, createdAt: this.clock().toISOString() };
    let indexed = false;
    if (this.embedder) {
      try {
        const values = await this.embedder.embed(clean.slice(0, 750));
        note.vector = { model: this.embedder.model, values };
        indexed = true;
      } catch {  }
    }
    this.data.notes.push(note);
    await this.save();
    return { note: { id: note.id, text: clean }, indexed };
  }

  async deleteNote(id) {
    this.checkReady();
    const length = this.data.notes.length;
    this.data.notes = this.data.notes.filter(note => note.id !== id);
    if (this.data.notes.length === length) return false;
    await this.save();
    return true;
  }

  async indexNotes() {
    this.checkReady();
    if (!this.embedder) return { indexed: 0, failed: this.data.notes.length };
    let indexed = 0, failed = 0;
    for (const note of this.data.notes) {
      if (note.vector?.model === this.embedder.model) continue;
      try {
        note.vector = { model: this.embedder.model, values: await this.embedder.embed(note.text.slice(0, 750)) };
        indexed++;
        await this.save();
      } catch { failed++; }
    }
    return { indexed, failed };
  }

  async searchNotes(query, { limit = 3, semantic = true } = {}) {
    this.checkReady();
    const clean = String(query).trim();
    if (!clean) return { results: [], mode: 'none' };
    let vector = null;
    if (semantic && this.embedder && this.data.notes.some(n => n.vector?.model === this.embedder.model)) {
      try { vector = await this.embedder.embed(clean.slice(0, 750)); } catch {  }
    }
    const scored = this.data.notes.map(note => {
      const lexical = overlap(clean, note.text);
      const similarity = vector && note.vector?.model === this.embedder.model
        ? cosine(vector, note.vector.values) : 0;
      const score = Math.max(lexical, similarity >= 0.32 ? similarity : 0);
      return { id: note.id, text: note.text, createdAt: note.createdAt, score };
    }).filter(n => n.score > 0).sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, limit), mode: vector ? 'semantic + keyword' : 'keyword' };
  }

  listTasks({ includeDone = true } = {}) {
    this.checkReady();
    return this.data.tasks.filter(task => includeDone || !task.done).map(task => ({ ...task }));
  }

  async addTask(text) {
    this.checkReady();
    const clean = String(text).trim();
    if (!clean || clean.length > 300) throw new Error('Task must be between 1 and 300 characters.');
    if (this.data.tasks.length >= MAX_TASKS) throw new Error('Maximum task count reached.');
    const task = { id: randomUUID().slice(0, 8), text: clean, done: false, createdAt: this.clock().toISOString() };
    this.data.tasks.push(task);
    await this.save();
    return { ...task };
  }

  async completeTaskByReference(reference) {
    this.checkReady();
    const candidate = String(reference).trim();
    if (!candidate) return { status: 'missing', matches: [] };
    const direct = this.data.tasks.find(t => t.id === candidate);
    if (direct) {
      if (direct.done) return { status: 'already-done', task: { ...direct } };
      await this.completeTask(direct.id);
      return { status: 'completed', task: { ...direct, done: true } };
    }
    const query = normalizeTask(candidate);
    if (!query || query.length > 300) return { status: 'missing', matches: [] };
    const open = this.data.tasks.filter(t => !t.done);
    const exact = open.filter(t => normalizeTask(t.text) === query);
    let matches = exact;
    if (!matches.length) {
      matches = open.filter(t => {
        const title = normalizeTask(t.text);
        return query.length >= 5 && (title.includes(query) || query.includes(title));
      });
    }
    if (!matches.length && query.length >= 8) {
      const ranked = open.map(t => ({ task: t, distance: editDistance(query, normalizeTask(t.text)) }));
      const best = Math.min(Infinity, ...ranked.map(x => x.distance));
      if (best <= Math.max(2, Math.floor(query.length * 0.15))) {
        matches = ranked.filter(x => x.distance === best).map(x => x.task);
      }
    }
    if (!matches.length) return { status: 'missing', matches: [] };
    if (matches.length > 1) return { status: 'ambiguous', matches: matches.map(t => ({ id: t.id, text: t.text })) };
    const task = matches[0];
    await this.completeTask(task.id);
    return { status: 'completed', task: { ...task, done: true } };
  }

  async completeTask(id) {
    this.checkReady();
    const task = this.data.tasks.find(item => item.id === id);
    if (!task) return false;
    task.done = true;
    task.completedAt = this.clock().toISOString();
    await this.save();
    return true;
  }
}
