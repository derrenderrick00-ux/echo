import { mkdir, readFile, writeFile, rename, rm, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class LocalCalendar {
  constructor({ filePath, clock = () => new Date() }) {
    if (!filePath) throw new Error('Calendar file path is required.');
    this.filePath = filePath;
    this.clock = clock;
    this.events = [];
  }
  async init() {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!data || data.version !== 1 || !Array.isArray(data.events) || data.events.some(x => typeof x.id !== 'string' || typeof x.title !== 'string' || typeof x.at !== 'string')) throw new Error('Invalid calendar format.');
      this.events = data.events;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot read local calendar: ${error.message}`);
    }
    return this;
  }
  async save() {
    const folder = dirname(this.filePath);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await chmod(folder, 0o700);
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, events: this.events }, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  list({ start, end } = {}) {
    const beginning = start === undefined ? -Infinity : new Date(start).getTime();
    const finish = end === undefined ? Infinity : new Date(end).getTime();
    return this.events.filter(x => { const ts = Date.parse(x.at); return ts >= beginning && ts <= finish; }).map(x => ({ ...x })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  async add(when, title) {
    const at = String(when).trim();
    const clean = String(title).trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(at) || !Number.isFinite(Date.parse(at))) throw new Error('Use an ISO timestamp with timezone, e.g. 2026-11-01T09:00+03:00.');
    if (!clean || clean.length > 300) throw new Error('Event title must be 1–300 characters.');
    if (Date.parse(at) <= this.clock().getTime()) throw new Error('New events must be in the future.');
    if (this.events.length >= 500) throw new Error('Maximum local calendar size reached.');
    const event = { id: randomUUID().slice(0, 8), at, title: clean, notified: false };
    this.events.push(event);
    await this.save();
    return { ...event };
  }
  async remove(id) {
    const before = this.events.length;
    this.events = this.events.filter(item => item.id !== String(id).trim());
    if (before === this.events.length) return false;
    await this.save();
    return true;
  }
  async due({ graceMinutes = 15 } = {}) {
    const now = this.clock().getTime();
    const due = this.events.filter(x => !x.notified && Date.parse(x.at) <= now && Date.parse(x.at) >= now - graceMinutes * 60000);
    if (!due.length) return [];
    for (const item of due) item.notified = true;
    await this.save();
    return due.map(x => ({ ...x }));
  }
}

export function formatEvents(events, timeZone = 'Africa/Nairobi') {
  if (!events.length) return 'No saved events.';
  const dt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone });
  return events.map(x => `[${x.id}] ${dt.format(new Date(x.at))}: ${x.title}`).join('\n');
}
