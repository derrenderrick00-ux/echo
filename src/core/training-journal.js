import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';

const ID = /^[0-9a-f]{8}$/;
const UNSAFE = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:api[_-]?key|password|token|secret)\s*[:=]\s*["']?\S{8,}/i;
function clean(text, label) {
  const value = String(text).trim();
  if (!value || value.length > 1400 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`${label} must be between 1 and 1400 printable characters.`);
  if (UNSAFE.test(value)) throw new Error('Possible credential detected. Do not add secrets to training data.');
  return value;
}
async function saveJson(path, data) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, path); await chmod(path, 0o600); }
  finally { await rm(temp, { force: true }); }
}
export class TrainingJournal {
  constructor({ filePath, clock = () => new Date() }) {
    this.filePath = filePath;
    this.clock = clock;
    this.data = { version: 1, examples: [] };
    this.proposals = new Map();
  }
  async init() {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (data?.version !== 1 || !Array.isArray(data.examples) || data.examples.length > 2000 || data.examples.some(x => !ID.test(x.id) || !x.prompt || !x.completion || x.source !== 'owner-approved' || !x.at)) throw new Error('Invalid approved training examples.');
      this.data = data;
    } catch (error) { if (error.code !== 'ENOENT') throw new Error(`Cannot safely read training journal: ${error.message}`); }
    return this;
  }
  propose(prompt, completion) {
    const p = clean(prompt, 'Prompt');
    const c = clean(completion, 'Target response');
    if (this.data.examples.length >= 2000) throw new Error('Training journal full.');
    if (this.data.examples.some(x => x.prompt.toLowerCase() === p.toLowerCase())) throw new Error('Prompt already approved. Revise the existing training plan instead of adding conflicting targets.');
    const id = randomUUID().slice(0, 8);
    this.proposals.set(id, { prompt: p, completion: c, at: Date.now() });
    return { id, prompt: p, completion: c };
  }
  async approve(id) {
    const draft = this.proposals.get(id);
    if (!draft || Date.now() - draft.at > 15 * 60000) throw new Error('Training proposal missing or expired.');
    this.proposals.delete(id);
    if (this.data.examples.some(x => x.prompt.toLowerCase() === draft.prompt.toLowerCase())) throw new Error('Duplicate training prompt.');
    const example = { id, prompt: draft.prompt, completion: draft.completion, source: 'owner-approved', at: this.clock().toISOString() };
    this.data.examples.push(example);
    await saveJson(this.filePath, this.data);
    return { ...example };
  }
  cancel(id) { return this.proposals.delete(id); }
  list() { return this.data.examples.map(x => ({ ...x })); }
  async delete(id) {
    const count = this.data.examples.length;
    this.data.examples = this.data.examples.filter(x => x.id !== id);
    if (this.data.examples.length === count) throw new Error('Training example not found.');
    await saveJson(this.filePath, this.data);
  }
  async exportSplit({ dir, minExamples = 8 } = {}) {
    const rows = this.list();
    if (rows.length < minExamples) throw new Error(`At least ${minExamples} approved examples required; currently ${rows.length}. No training files exported.`);
    const seen = new Set();
    for (const row of rows) {
      const key = row.prompt.trim().toLowerCase();
      if (seen.has(key)) throw new Error('Duplicate input would leak between splits.');
      seen.add(key);
    }
    const sorted = rows.map(row => ({ ...row, hash: createHash('sha256').update(row.prompt.toLowerCase()).digest('hex') })).sort((a, b) => a.hash.localeCompare(b.hash));
    const holdoutCount = Math.max(1, Math.round(sorted.length * 0.2));
    const holdout = sorted.slice(0, holdoutCount);
    const training = sorted.slice(holdoutCount);
    const format = items => items.map(x => JSON.stringify({ prompt: [{ role: 'user', content: x.prompt }], completion: [{ role: 'assistant', content: x.completion }] })).join('\n') + '\n';
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const trainPath = `${dir}/train.jsonl`, evalPath = `${dir}/eval.jsonl`;
    for (const [file, rows] of [[trainPath, training],[evalPath, holdout]]) {
      const temp = `${file}.${randomUUID()}.tmp`;
      try { await writeFile(temp, format(rows), { flag: 'wx', mode: 0o600 }); await rename(temp, file); await chmod(file, 0o600); }
      finally { await rm(temp, { force: true }); }
    }
    return { train: training.length, eval: holdout.length, trainPath, evalPath, note: 'These are owner-approved examples, not automatically fact-checked; review and scrub PII before copying to any GPU machine.' };
  }
}

export const TRAINING_HELP = 'Commands: /train help | /train add <prompt> | <ideal answer> | /train confirm <id> | /train reject <id> | /train list | /train delete <id>. Export with npm run finetune:prepare (minimum 8 approved examples). Fine-tuning runs separately on a compatible CUDA GPU; the Ollama model is NOT retrained by /train.';
export async function trainingCommand(journal, line) {
  const trimmed = line.trim();
  if (!trimmed.toLowerCase().startsWith('/train')) return null;
  if (trimmed === '/train' || trimmed === '/train help') return { text: TRAINING_HELP };
  const match = trimmed.match(/^\/train add (.+?)\s*\|\s*(.+)$/is);
  if (match) {
    const draft = journal.propose(match[1], match[2]);
    return { text: `Training proposal [${draft.id}] — not saved. Prompt: ${draft.prompt}\nIdeal answer: ${draft.completion}\nType /train confirm ${draft.id} to approve. No model training has occurred.` };
  }
  const cmd = trimmed.match(/^\/train (confirm|reject|delete) ([0-9a-f]{8})$/);
  if (cmd) {
    if (cmd[1] === 'confirm') { await journal.approve(cmd[2]); return { text: `Approved private training example [${cmd[2]}]. Model weights unchanged.` }; }
    if (cmd[1] === 'reject') return { text: journal.cancel(cmd[2]) ? `Rejected proposal [${cmd[2]}].` : 'Proposal not found.' };
    await journal.delete(cmd[2]); return { text: `Removed training example [${cmd[2]}] from active dataset. Previously exported copies may still exist.` };
  }
  if (trimmed === '/train list') return { text: journal.list().map(x => `[${x.id}] ${x.prompt} → ${x.completion}`).join('\n') || 'No approved training examples.' };
  return { text: TRAINING_HELP };
}
