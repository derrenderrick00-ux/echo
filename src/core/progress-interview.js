import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, writeFile, rename, rm, chmod } from 'node:fs/promises';

export const INTERVIEW_QUESTIONS = [
  ['academic', 'What has changed in your university studies, semester or current academic focus?'],
  ['software', 'What can you now build independently in JavaScript, Node.js, databases or other languages?'],
  ['cybermath', 'What have you covered in cybersecurity, networking, discrete mathematics and DSA?'],
  ['projects', 'Give your current project statuses. To change a status, use Name: active/planning/maintenance/on hold/concept/completed; separate projects with semicolons.'],
  ['achievements', 'Which specific milestones or tests have you completed since the last review? Mark claims that you have not verified.'],
  ['blockers', 'What problems or resource limits currently block progress?'],
  ['next', 'What are your next three realistic actions?'],
  ['preferences', 'Have your learning method, answer length, coding style, or voice preferences changed?'],
  ['other', 'Any other progress or correction you want recorded? Say skip if none.'],
];

export class ProgressInterview {
  constructor({ secretPath, context, clock = () => Date.now() }) {
    this.secretPath = secretPath;
    this.context = context;
    this.clock = clock;
    this.credentials = null;
    this.unlockedUntil = 0;
    this.failures = 0;
    this.blockedUntil = 0;
    this.draft = null;
  }
  async init() {
    try {
      const creds = JSON.parse(await readFile(this.secretPath, 'utf8'));
      if (creds.version !== 1 || !/^[0-9a-f]{32}$/.test(creds.salt) || !/^[0-9a-f]{128}$/.test(creds.hash)) throw new Error('Invalid interview access configuration.');
      this.credentials = creds;
    } catch (error) { if (error.code !== 'ENOENT') throw new Error(`Interview access configuration cannot load safely: ${error.message}`); }
    return this;
  }
  async setup(secret) {
    if (this.credentials) throw new Error('Interview combination already configured; do not overwrite it from a chat session.');
    if (typeof secret !== 'string' || secret.length < 12 || secret.length > 128 || /[\r\n\x00]/.test(secret)) throw new Error('Use a unique 12–128 character local combination (not your account password).');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(secret, Buffer.from(salt, 'hex'), 64).toString('hex');
    const directory = dirname(this.secretPath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const temp = `${this.secretPath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temp, JSON.stringify({ version: 1, salt, hash }), { flag: 'wx', mode: 0o600 });
      await rename(temp, this.secretPath);
      await chmod(this.secretPath, 0o600);
    } finally { await rm(temp, { force: true }); }
    this.credentials = { version: 1, salt, hash };
    return 'Private progress-interview combination configured. Only a salted scrypt hash was saved; no plaintext secret was stored.';
  }
  unlock(secret) {
    if (!this.credentials) throw new Error('Configure your secret first with /interview setup.');
    if (this.clock() < this.blockedUntil) throw new Error('Too many unsuccessful attempts. Try again in five minutes.');
    const expected = Buffer.from(this.credentials.hash, 'hex');
    const candidate = scryptSync(String(secret), Buffer.from(this.credentials.salt, 'hex'), 64);
    if (!timingSafeEqual(candidate, expected)) {
      this.failures++;
      if (this.failures >= 3) { this.blockedUntil = this.clock() + 5 * 60_000; this.failures = 0; }
      throw new Error('Incorrect interview combination. Nothing unlocked or updated.');
    }
    this.failures = 0;
    this.unlockedUntil = this.clock() + 30 * 60_000;
    return 'Progress interview unlocked for ten minutes in this CLI session. Type /interview start.';
  }
  isUnlocked() { return this.clock() < this.unlockedUntil; }
  needUnlock() { if (!this.isUnlocked()) throw new Error('Interview locked. Type /interview unlock and enter your combination privately.'); }
  lock() { this.unlockedUntil = 0; this.draft = null; return 'Interview locked; unconfirmed answers discarded.'; }
  start() {
    this.needUnlock();
    this.draft = { index: 0, answers: {}, startedAt: this.clock() };
    return `Progress interview started. No answers will be saved until /interview confirm.\nQuestion 1/${INTERVIEW_QUESTIONS.length}: ${INTERVIEW_QUESTIONS[0][1]}\nRespond with /interview answer <text>, or type skip. Use /interview cancel to discard.`;
  }
  answer(value) {
    this.needUnlock();
    if (!this.draft || this.draft.index >= INTERVIEW_QUESTIONS.length) throw new Error('No open interview question. Use /interview start.');
    const text = String(value).trim();
    if (!text || text.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('Answer must be 1–1000 printable characters.');
    const [key] = INTERVIEW_QUESTIONS[this.draft.index];
    if (text.toLowerCase() !== 'skip') this.draft.answers[key] = text;
    this.draft.index++;
    return this.draft.index < INTERVIEW_QUESTIONS.length ? `Recorded provisionally. Question ${this.draft.index + 1}/${INTERVIEW_QUESTIONS.length}: ${INTERVIEW_QUESTIONS[this.draft.index][1]}` : 'Interview complete but NOT SAVED. Type /interview preview, then /interview confirm to store the answers; or /interview cancel.';
  }
  preview() {
    this.needUnlock();
    if (!this.draft) throw new Error('No interview in progress.');
    return `UNCOMMITTED progress review (${this.draft.index}/${INTERVIEW_QUESTIONS.length} questions):\n${Object.entries(this.draft.answers).map(([key, value]) => `${key}: ${value}`).join('\n') || 'No answers recorded.'}\nNothing has been saved. Confirm only after checking all entries.`;
  }
  async confirm() {
    this.needUnlock();
    if (!this.draft || this.draft.index < INTERVIEW_QUESTIONS.length) throw new Error('Finish the interview before confirming.');
    const count = Object.keys(this.draft.answers).length;
    if (!count) throw new Error('No answers to save. Cancel instead.');
    const at = await this.context.applyInterview(this.draft.answers);
    this.draft = null;
    this.unlockedUntil = 0;
    return `Saved ${count} user-confirmed interview answers in private context at ${at}. Interview locked again. This updated reference memory, not Ollama model weights.`;
  }
  handleCommand(line) {
    const lower = line.toLowerCase().trim();
    if (lower === '/interview help' || lower === '/interview') return { text: 'Private progress review: /interview setup (first time), /interview unlock (masked entry), /interview start, /interview answer <text>, /interview preview, /interview confirm, /interview cancel, /interview lock. Secret is never typed into a normal Echo message.' };
    if (lower === '/interview setup') return { text: this.credentials ? 'Already configured; no change.' : 'Enter a unique private combination when prompted.', secretAction: this.credentials ? undefined : 'setup', announcement: true };
    if (lower === '/interview unlock') return { text: this.credentials ? 'Enter your private combination when prompted.' : 'First use /interview setup.', secretAction: this.credentials ? 'unlock' : undefined, announcement: true };
    if (lower === '/interview lock' || lower === '/interview cancel') return { text: this.lock() };
    if (lower === '/interview start') return { text: this.start() };
    if (lower === '/interview preview') return { text: this.preview() };
    if (lower === '/interview confirm') return { pendingInterviewCommit: true };
    if (lower.startsWith('/interview answer ')) return { text: this.answer(line.slice(18)) };
    if (lower.startsWith('/interview ')) return { text: 'Unknown interview command. Use /interview help.' };
    if (this.draft && this.isUnlocked() && !line.startsWith('/')) return { text: this.answer(line) };
    return null;
  }
}
