import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { readFile, writeFile, rename, rm, chmod, mkdir } from 'node:fs/promises';

function dayOf(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(date);
  const item = type => parts.find(x => x.type === type)?.value;
  return `${item('year')}-${item('month')}-${item('day')}`;
}

const TYPES = new Set(['done', 'blocker', 'next']);

export class DailyReview {
  constructor({ filePath, reportPath = null, qualityPath = null, clock = () => new Date(), timeZone = 'Africa/Nairobi' }) {
    this.filePath = filePath;
    this.reportPath = reportPath;
    this.qualityPath = qualityPath;
    this.clock = clock;
    this.timeZone = timeZone;
    this.data = { version: 1, entries: [] };
  }
  async init() {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 500 || data.entries.some(x => !TYPES.has(x.type) || !/^[0-9a-f]{8}$/.test(x.id) || typeof x.text !== 'string' || x.text.length > 300 || typeof x.at !== 'string')) throw new Error('Invalid daily review records.');
      this.data = data;
    } catch (error) { if (error.code !== 'ENOENT') throw new Error(`Daily review file cannot be read safely: ${error.message}`); }
    return this;
  }
  async save() {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(this.data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } finally { await rm(temporary, { force: true }); }
  }
  async add(type, raw) {
    if (!TYPES.has(type)) throw new Error('Log type must be done, blocker or next.');
    const text = String(raw).trim();
    if (!text || text.length > 300 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('Development log entry must be 1–300 printable characters.');
    if (this.data.entries.length >= 500) throw new Error('Daily log capacity reached. Back up and archive old entries.');
    const item = { id: randomUUID().slice(0, 8), type, text, at: this.clock().toISOString(), source: 'manual-user-report' };
    this.data.entries.push(item);
    await this.save();
    return { ...item };
  }
  list({ day = null } = {}) {
    return this.data.entries.filter(x => !day || dayOf(new Date(x.at), this.timeZone) === day).map(x => ({ ...x }));
  }
  async tests() {
    if (!this.reportPath) return null;
    try {
      const data = JSON.parse(await readFile(this.reportPath, 'utf8'));
      if (data?.version !== 1 || typeof data.at !== 'string' || !Number.isInteger(data.passed) || !Number.isInteger(data.failed) || !Number.isInteger(data.total) || typeof data.ok !== 'boolean') return null;
      return data;
    } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Recorded test report is malformed.'); }
  }
  async quality() {
    if (!this.qualityPath) return null;
    try {
      const data = JSON.parse(await readFile(this.qualityPath, 'utf8'));
      if (data?.version !== 1 || typeof data.at !== 'string' || !Number.isInteger(data.total) || !Number.isInteger(data.passed) || !Number.isInteger(data.failed) || data.total <= 0 || data.passed + data.failed !== data.total) return null;
      return data;
    } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Recorded intent evaluation is malformed.'); }
  }
  async render({ memory, actionJournal = null } = {}) {
    const today = dayOf(this.clock(), this.timeZone);
    const tasks = memory.listTasks();
    const doneToday = tasks.filter(t => t.done && t.completedAt && dayOf(new Date(t.completedAt), this.timeZone) === today);
    const open = tasks.filter(t => !t.done);
    const entries = this.list({ day: today });
    const byType = type => entries.filter(e => e.type === type);
    const report = await this.tests();
    const quality = await this.quality();
    const audit = actionJournal?.audit().filter(x => x.status === 'approved' && dayOf(new Date(x.at), this.timeZone) === today) ?? [];
    return [
      `Echo daily review — ${today} (${this.timeZone}; device clock)`,
      'Tasks marked completed in local records today (work not independently verified):',
      ...(doneToday.length ? doneToday.map(t => `[x] [${t.id}] ${t.text}`) : ['None recorded today.']),
      'Manually reported development accomplishments (not independently verified):',
      ...(byType('done').length ? byType('done').map(x => `[${x.id}] ${x.text}`) : ['None recorded.']),
      `Approved local actions today: ${audit.length} (from local action journal).`,
      'Pending saved tasks:',
      ...(open.length ? open.slice(0, 15).map(t => `[ ] [${t.id}] ${t.text}`) : ['No incomplete tasks.']),
      ...(open.length > 15 ? [`${open.length - 15} more tasks; use /task pending.`] : []),
      'Blockers (manually reported):',
      ...(byType('blocker').length ? byType('blocker').map(x => `- ${x.text}`) : ['None reported.']),
      'Planned next actions (manually reported):',
      ...(byType('next').length ? byType('next').map(x => `- ${x.text}`) : ['None recorded.']),
      report ? `Last automated test run: ${report.at}; ${report.passed}/${report.total} passed, ${report.failed} failed; exit status ${report.ok ? 'success' : 'failure'}.` : 'No locally recorded automated test run. Execute npm run test:record in Ubuntu.',
      quality ? `Last curated intent-routing evaluation: ${quality.at}; ${quality.passed}/${quality.total} correct (${(100 * quality.passed / quality.total).toFixed(1)}%). This is not a general model-accuracy score.` : 'No local routing evaluation recorded. Execute npm run evaluate in Ubuntu.',
      'Only saved records and explicitly reported accomplishments are shown; no GitHub, external calendar or autonomous project progress was inferred.',
    ].join('\n');
  }
}
