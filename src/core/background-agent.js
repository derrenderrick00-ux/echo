import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, chmod, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const TYPES = new Set(['tasks', 'calendar', 'daily-review', 'resources']);
const DATE = /^\d{4}-\d\d-\d\d$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[0-9a-f]{8}$/;

async function atomicJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(dirname(filePath), 0o700);
  const temp = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temp, filePath);
    await chmod(filePath, 0o600);
  } finally { await rm(temp, { force: true }); }
}

function zoned(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(now);
  const part = type => parts.find(x => x.type === type)?.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, minute: Number(part('hour')) * 60 + Number(part('minute')) };
}

function validate(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.jobs) || !Array.isArray(state.audit) || state.jobs.length > 12 || state.audit.length > 400) throw new Error('Background configuration is corrupt or exceeds limits.');
  const ids = new Set();
  for (const job of state.jobs) {
    if (!ID.test(job.id) || ids.has(job.id) || !TYPES.has(job.type) || !TIME.test(job.at) || typeof job.enabled !== 'boolean' || !(job.lastRunDay === null || DATE.test(job.lastRunDay))) throw new Error('Invalid saved background job.');
    ids.add(job.id);
  }
  if (state.timeZone !== undefined) {
    if (typeof state.timeZone !== 'string' || state.timeZone.length > 120) throw new Error('Invalid background time zone.');
    try { new Intl.DateTimeFormat('en-GB', { timeZone: state.timeZone }); }
    catch { throw new Error('Invalid background time zone.'); }
  }
  for (const event of state.audit) if (typeof event.at !== 'string' || !['success','failed','skipped'].includes(event.status) || typeof event.summary !== 'string' || event.summary.length > 250) throw new Error('Invalid background audit event.');
  return state;
}

export class BackgroundAgent {
  constructor({ filePath, inboxDir, timeZone = 'Africa/Nairobi', clock = () => new Date(), memory = null, calendar = null, dailyReview = null, resources = null }) {
    this.filePath = filePath;
    this.inboxDir = inboxDir;
    this.timeZone = timeZone;
    this.clock = clock;
    this.memory = memory;
    this.calendar = calendar;
    this.dailyReview = dailyReview;
    this.resources = resources;
    new Intl.DateTimeFormat('en-GB', { timeZone });
    this.state = { version: 1, jobs: [], audit: [], timeZone }; 
    this.proposals = new Map();
  }
  async init() {
    try { this.state = validate(JSON.parse(await readFile(this.filePath, 'utf8'))); if (this.state.timeZone) this.timeZone = this.state.timeZone; }
    catch (error) { if (error.code !== 'ENOENT') throw new Error(`Cannot safely load background configuration: ${error.message}`); }
    return this;
  }
  async save() { await atomicJson(this.filePath, this.state); }
  jobs() { return this.state.jobs.map(job => ({ ...job })); }
  audit() { return this.state.audit.slice(-20).map(x => ({ ...x })); }
  propose(type, at) {
    if (!TYPES.has(type) || !TIME.test(at)) throw new Error('Allowed: tasks, calendar, daily-review, resources; time must be HH:MM in Echo timezone.');
    if (this.state.jobs.length >= 12) throw new Error('Maximum of 12 scheduled jobs reached.');
    if (this.state.jobs.some(x => x.type === type && x.at === at)) throw new Error('An identical job already exists.');
    const id = randomUUID().slice(0, 8);
    this.proposals.set(id, { type, at, madeAt: Date.now() });
    return { id, type, at, timeZone: this.timeZone };
  }
  async confirm(id) {
    const proposal = this.proposals.get(id);
    if (!proposal || Date.now() - proposal.madeAt > 15 * 60000) throw new Error('Pending job proposal not found or expired. Schedule it again.');
    this.proposals.delete(id);
    if (this.state.jobs.some(x => x.type === proposal.type && x.at === proposal.at)) throw new Error('Duplicate job rejected.');
    const job = { id, type: proposal.type, at: proposal.at, enabled: true, lastRunDay: null };
    this.state.jobs.push(job);
    this.state.timeZone = this.timeZone;
    await this.save();
    return { ...job };
  }
  async change(id, verb) {
    const index = this.state.jobs.findIndex(x => x.id === id);
    if (index < 0) throw new Error(`Job [${id}] not found.`);
    if (verb === 'delete') this.state.jobs.splice(index, 1);
    else if (verb === 'pause') this.state.jobs[index].enabled = false;
    else if (verb === 'resume') this.state.jobs[index].enabled = true;
    else throw new Error('Allowed actions: pause, resume, delete.');
    await this.save();
  }
  async content(type, now) {
    if (type === 'tasks') {
      if (!this.memory) throw new Error('Task store unavailable to background worker.');
      const tasks = this.memory.listTasks({ includeDone: false });
      return ['# Pending Tasks', `Generated: ${now.toISOString()}`, 'Source: saved local tasks only.', '', ...(tasks.length ? tasks.map(x => `- [ ] ${x.text.replaceAll('\n', ' ')} [${x.id}]`) : ['No pending tasks.'])].join('\n') + '\n';
    }
    if (type === 'calendar') {
      if (!this.calendar) throw new Error('Calendar unavailable to background worker.');
      const events = this.calendar.list({ start: now.toISOString(), end: new Date(now.getTime() + 24 * 3600000).toISOString() });
      return ['# Upcoming Local Events (24 hours)', `Generated: ${now.toISOString()}`, 'No remote calendar or alerts delivered.', '', ...(events.length ? events.map(x => `- ${x.at}: ${x.title.replaceAll('\n', ' ')} [${x.id}]`) : ['No events in this window.'])].join('\n') + '\n';
    }
    if (type === 'daily-review') {
      if (!this.dailyReview || !this.memory) throw new Error('Daily review unavailable to background worker.');
      return '# Local Development Review\n\n' + await this.dailyReview.render({ memory: this.memory });
    }
    if (type === 'resources') {
      if (!this.resources) throw new Error('Resource monitor unavailable to background worker.');
      return '# Device Resources\n\n' + await this.resources() + '\n';
    }
    throw new Error('Unapproved job type.');
  }
  async runDue({ now = this.clock(), maxLateMinutes = 120 } = {}) {
    if (!Number.isInteger(maxLateMinutes) || maxLateMinutes < 0 || maxLateMinutes > 1440) throw new Error('Invalid catch-up window.');
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const lockPath = `${this.filePath}.lock`;
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw new Error(`Background worker is already running or lock is stale: ${lockPath}`); throw error; }
    const done = [];
    try {
      await this.init();
      const { day, minute } = zoned(now, this.timeZone);
      for (const job of this.state.jobs) {
        const scheduled = Number(job.at.slice(0, 2)) * 60 + Number(job.at.slice(3));
        if (!job.enabled || job.lastRunDay === day || minute < scheduled || minute - scheduled > maxLateMinutes) continue;
        job.lastRunDay = day;
        await this.save();
        try {
          const body = await this.content(job.type, now);
          await mkdir(this.inboxDir, { recursive: true, mode: 0o700 });
          await chmod(this.inboxDir, 0o700);
          const file = join(this.inboxDir, `${day}-${job.id}.md`);
          await writeFile(file, body, { flag: 'wx', mode: 0o600 });
          this.state.audit.push({ at: now.toISOString(), jobId: job.id, status: 'success', summary: `Generated ${job.type} local report ${day}-${job.id}.md` });
          done.push({ id: job.id, status: 'success', report: file });
        } catch (error) {
          this.state.audit.push({ at: now.toISOString(), jobId: job.id, status: 'failed', summary: `Job ${job.type} failed: ${String(error.message).slice(0, 170)}` });
          done.push({ id: job.id, status: 'failed', error: error.message });
        }
        this.state.audit = this.state.audit.slice(-400);
        await this.save();
      }
      return done;
    } finally { await lock.close(); await rm(lockPath, { force: true }); }
  }
}

export const BACKGROUND_HELP = 'Commands: /background status | schedule <tasks|calendar|daily-review|resources> HH:MM | confirm <id> | pause <id> | resume <id> | delete <id> | audit. Jobs run only if you install and enable the optional systemd user timer. No LLM, network, shell, email or external messaging actions.';

export async function backgroundCommand(agent, line) {
  const args = line.trim().split(/\s+/);
  if (args[0] !== '/background') return null;
  if (args.length === 1 || args[1] === 'help') return { text: BACKGROUND_HELP };
  if (args[1] === 'status' && args.length === 2) {
    const jobs = agent.jobs();
    return { text: jobs.length ? jobs.map(j => `[${j.id}] ${j.type} daily ${j.at} (${agent.timeZone}), ${j.enabled ? 'enabled' : 'paused'}, last: ${j.lastRunDay || 'never'}`).join('\n') + '\nCheck systemctl --user status echo-background.timer to verify the timer itself.' : 'No approved background jobs. Timer status is not inferred.' };
  }
  if (args[1] === 'schedule' && args.length === 4) {
    const job = agent.propose(args[2], args[3]);
    return { text: `Proposal [${job.id}]: ${job.type} daily at ${job.at} (${job.timeZone}). Nothing scheduled yet. Type /background confirm ${job.id} to approve; then enable the optional systemd timer in Ubuntu.` };
  }
  if (args[1] === 'confirm' && args.length === 3) {
    const job = await agent.confirm(args[2]);
    return { text: `Approved daily job [${job.id}]. Only a local report can be written. The background timer must be enabled separately in Ubuntu.` };
  }
  if (['pause','resume','delete'].includes(args[1]) && args.length === 3) {
    await agent.change(args[2], args[1]);
    return { text: `Job [${args[2]}] ${args[1] === 'delete' ? 'deleted' : args[1] === 'pause' ? 'paused' : 'resumed'}.` };
  }
  if (args[1] === 'audit' && args.length === 2) return { text: agent.audit().map(x => `${x.at} [${x.jobId}] ${x.status}: ${x.summary}`).join('\n') || 'No background execution records.' };
  return { text: BACKGROUND_HELP };
}
