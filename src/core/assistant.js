import { parseIntent } from './intent.js';
import { calculateText } from './math.js';
import { capabilitySummary } from './capabilities.js';
import { formatEvents } from './calendar.js';
import { briefing } from './briefings.js';
import { summarizeText, decisionPrompt } from './summarize.js';
import { Games } from './games.js';
import { timeoutExplanation, voiceSetup, javascriptDateExplanation } from './diagnostics.js';
import { Phase2Commands } from './phase2-commands.js';
import { resourceSummary } from './resources.js';
import { Phase3Commands } from './phase3-commands.js';
import { programmingFact } from './programming-facts.js';
import { parseBaseConversion } from './number-systems.js';

export const HELP = [
  'Commands: /help /menu /status /model /profile /identity /abilities /date /diagnostics /resources /reset /continue /exit',
  'Notes: /remember <text> /notes /recall <query> /forget <note-id> /index /summarize notes',
  'Tasks: /task list /task add <text> /task done <id or description> /routine',
  'Calendar: /event list /event add 2026-11-01T09:00+03:00 | Event name /event delete <id>',
  'Routine: /brief morning /brief evening',
  'Learning: /summarize <text> /decide Option A | Option B',
  'Games: /game trivia technology /game trivia general /game wordchain /game guess /game quit',
  'Phase 2: /phase2 help /code check /code files /code run <name.js> /code generate <requirement> /idea /decision /preference',
  'Phase 3: /phase3 help /actions /approve <id> /reject <id> /audit /device /sync',
  'Reliability: /task pending /task completed /task status <name> /review today /devlog done|blocker|next <text> /devlog list /accuracy',
  'Voice: /voice check /voice test /voice on /voice off /voice reply /voice speak <text> /voice listen [seconds] /voice ask [seconds] /voice chat [seconds] /voice transcribe <file.wav>',
  'Offline calendar alerts only run while this CLI remains open. No internet, messaging, or unattended remote actions are implemented.',
].join('\n');

function formatNotes(notes) {
  return notes.length ? notes.map(n => `[${n.id}] ${n.text}`).join('\n') : 'No saved notes.';
}

function formatTasks(tasks) {
  return tasks.length ? tasks.map(t => `${t.done ? '[x]' : '[ ]'} [${t.id}] ${t.text}`).join('\n') : 'No tasks saved.';
}

function formatTaskResult(result, reference) {
  if (result.status === 'completed') return `Completed task [${result.task.id}]: ${result.task.text}`;
  if (result.status === 'already-done') return `Already completed: [${result.task.id}] ${result.task.text}`;
  if (result.status === 'ambiguous') return 'Multiple tasks match. Use an ID:\n' + result.matches.map(t => `[${t.id}] ${t.text}`).join('\n');
  return `No open task matches "${reference}". Use /task list to see the exact description.`;
}

export class AssistantController {
  constructor({ session, memory, calendar, profileState, model, embeddingModel, voice = null, statusText = () => '', timeZone = 'Africa/Nairobi', clock = () => new Date(), phase2Workspace = null, codeSandbox = null, actionJournal = null, manualSync = null, dailyReview = null }) {
    this.session = session;
    this.memory = memory;
    this.calendar = calendar;
    this.profileState = profileState;
    this.model = model;
    this.embeddingModel = embeddingModel;
    this.voice = voice;
    this.statusText = statusText;
    this.timeZone = timeZone;
    this.clock = clock;
    this.games = new Games();
    this.lastAnswer = '';
    this.lastMathPlain = null;
    this.lastOutput = '';
    this.lastUserQuestion = '';
    this.lastVerifiedConversion = null;
    this.dailyReview = dailyReview;
    this.voiceReplies = false;
    this.voicePending = null;
    this.phase2 = phase2Workspace && codeSandbox ? new Phase2Commands({ workspace: phase2Workspace, sandbox: codeSandbox }) : null;
    this.phase3 = actionJournal && manualSync ? new Phase3Commands({ journal: actionJournal, sync: manualSync, memory }) : null;
  }
  async answer(input, { onToken } = {}) {
    const result = await this.process(input, { onToken });
    if (result?.text && !result.exit && !result.announcement) this.lastOutput = result.text;
    if (result?.text && !result.exit && !result.announcement && this.voiceReplies && !result.speak) return { ...result, speak: true };
    return result;
  }
  async enableVoice() {
    if (!this.voice) return { text: 'Voice provider is unavailable. See /voice setup.', announcement: true };
    try { await this.voice.requireOutput(); }
    catch (error) { return { text: `Voice replies not enabled: ${error.message}`, announcement: true }; }
    this.voiceReplies = true;
    return { text: 'Voice replies enabled for this session. Echo will speak after each completed text reply. Use /voice off to stop.', announcement: true, speak: true, activationSpeech: true };
  }
  async hearAndAnswer(seconds, { speak = false, onToken } = {}) {
    if (!this.voice) return { text: 'Voice provider is unavailable.', announcement: true };
    if (speak) {
      try { await this.voice.requireOutput(); }
      catch (error) { return { text: `Spoken voice chat unavailable: ${error.message}`, announcement: true }; }
    }
    await this.voice.requireInput();
    const transcript = (await this.voice.listen({ seconds })).trim();
    if (!transcript) return { text: 'No speech recognized. Nothing was sent to Echo.', heard: '', announcement: true };
    if (this.voicePending && /^(?:confirm|yes\s+confirm|yes\s+save\s+it)$/i.test(transcript)) {
      const pending = this.voicePending;
      this.voicePending = null;
      if (Date.now() - pending.at > 60_000) return { text: 'Spoken approval expired. Repeat your request.', heard: transcript, announcement: true };
      const result = pending.type === 'remember' ? await this.remember(pending.text) : await this.addTask(pending.text);
      return { ...result, heard: transcript, speak, announcement: true };
    }
    if (this.voicePending && /^(?:cancel|no\s+cancel|no\s+don't)$/i.test(transcript)) {
      this.voicePending = null;
      return { text: 'Cancelled. Nothing was saved.', heard: transcript, speak, announcement: true };
    }
    this.voicePending = null;
    const change = parseIntent(transcript);
    if (transcript.startsWith('/')) return { text: `I heard: ${transcript}\nSlash commands cannot run from speech. Type it to confirm.`, heard: transcript, announcement: true };
    if (['remember', 'addTask', 'suggestTask'].includes(change?.type)) {
      this.voicePending = { type: change.type === 'remember' ? 'remember' : 'addTask', text: change.text, at: Date.now() };
      return { text: `I heard: ${transcript}\nThis would save information. Nothing has been saved yet. To confirm, say 'confirm' in your next /voice chat 5 or /voice ask 5 exchange, or Type it to confirm. Say 'cancel' to discard.`, heard: transcript, speak, announcement: true };
    }
    if (['completeTask', 'deleteTask', 'deleteNote'].includes(change?.type)) {
      return { text: `I heard: ${transcript}\nThis would change existing data. Type it to confirm.`, heard: transcript, announcement: true };
    }
    const result = await this.process(transcript, { onToken });
    return { ...result, heard: transcript, speak: speak || result.speak };
  }
  async process(input, { onToken } = {}) {
    const line = String(input).trim();
    const lower = line.toLowerCase();
    if (!line) return { text: '' };
    if (!/^\d{1,40}\?$/.test(line) && parseBaseConversion(line) === null) this.lastVerifiedConversion = null;
    const spokenQuery = line.match(/^(?:(?:please\s+)?(?:answer|respond|reply|say)(?:\s+to\s+me)?\s+(?:in|with)\s+voice)\s*[:,-]?\s+(.+)$/is);
    if (spokenQuery) {
      const check = await this.prepareSingleSpeech();
      if (check) return check;
      const result = await this.process(spokenQuery[1], { onToken });
      return { ...result, speak: true };
    }
    if (/^(?:(?:please\s+)?(?:answer|respond|reply|say)(?:\s+to\s+me)?\s+(?:in|with)\s+voice|(?:turn\s+on|enable)\s+(?:my\s+)?voice(?:\s+mode)?)\.?$/i.test(line)) return this.enableVoice();
    if (/^(?:stop\s+speaking|stop\s+voice\s+replies|(?:turn\s+off|disable)\s+voice(?:\s+mode)?)\.?$/i.test(line)) return this.process('/voice off');
    if (/^(?:listen\s+to\s+me|take\s+voice\s+input|i\s+want\s+to\s+speak\s+to\s+you)\.?$/i.test(line)) return this.process('/voice ask 5', { onToken });
    if (/^(?:just (?:the )?direct answer|just answer|answer directly|give (?:me )?(?:the )?direct answer)\.?$/i.test(line)) {
      const last = this.lastMathPlain;
      this.lastMathPlain = null;
      return { text: last || 'Specify the exact question or calculation to answer directly.' };
    }
    this.lastMathPlain = null;
    if (/^\d{1,40}\?$/i.test(line) && this.lastVerifiedConversion) return { text: `Verified conversion, not a guess: ${this.lastVerifiedConversion}` };
    if (['/exit','/quit','exit','quit','/bye'].includes(lower)) return { exit: true };
    if (lower === '/game quit') return { text: this.games.respond('q') ?? 'No game is running.' };
    if (this.games.state && !lower.startsWith('/')) return { text: this.games.respond(line) };
    if (lower.startsWith('/game ')) {
      const request = lower.slice(6).trim().split(/\s+/);
      return { text: this.games.start(request[0], request[1] || 'technology') };
    }
    if (['/help','/menu','/commands'].includes(lower)) return { text: HELP };
    if (lower === '/status') return { text: this.statusText() };
    if (lower === '/model') return { text: `Local chat: ${this.model}. Embeddings: ${this.embeddingModel}.` };
    if (['/abilities', '/capabilities'].includes(lower)) return { text: capabilitySummary() };
    if (lower === '/profile') return { text: this.profileState.loaded ? 'Private local profile loaded.' : 'No private profile loaded.' };
    if (lower === '/identity') return { text: this.identity() };
    if (lower === '/date') return { text: this.dateTime() };
    if (lower === '/diagnostics') return { text: this.diagnostics() };
    if (lower === '/resources') return { text: await resourceSummary() };
    if (lower === '/reset') { this.session.reset(); this.lastAnswer = ''; this.games.state = null; return { text: 'Conversation cleared. Saved notes, tasks and calendar events remain.' }; }
    if (lower === '/continue' || lower === 'continue your last answer') {
      if (!this.lastAnswer) return { text: 'There is no previous answer to continue.' };
      return this.chat('Continue the preceding answer from where it ended, without repeating prior paragraphs. If it was already complete, say so.', onToken);
    }
    if (lower === '/notes') return { text: formatNotes(this.memory.listNotes()) };
    if (['/remember','/recall','/forget'].includes(lower)) return { text: `Usage: ${lower} <${lower === '/remember' ? 'text' : lower === '/recall' ? 'search query' : 'note-id'}>` };
    if (lower.startsWith('/remember ')) return this.remember(line.slice(10));
    if (lower.startsWith('/forget ')) {
      const id = line.slice(8).trim();
      return { text: await this.memory.deleteNote(id) ? `Deleted note [${id}].` : `Note [${id}] not found.` };
    }
    if (lower === '/index') {
      const data = await this.memory.indexNotes();
      return { text: `Indexed ${data.indexed} notes; ${data.failed} failed.` };
    }
    if (lower.startsWith('/recall ')) {
      const data = await this.memory.searchNotes(line.slice(8));
      return { text: `Memory search (${data.mode}):\n${formatNotes(data.results)}` };
    }
    if (lower === '/task') return { text: 'Usage: /task list | /task add <text> | /task done <ID or description>' };
    if (lower === '/task list') return { text: formatTasks(this.memory.listTasks()) };
    if (lower === '/task pending' || lower === '/task open') return { text: `Pending (incomplete) tasks:
${formatTasks(this.memory.listTasks({ includeDone: false }))}` };
    if (lower === '/task completed' || lower === '/task done-list') return { text: `Completed tasks:
${formatTasks(this.memory.listTasks().filter(t => t.done))}` };
    if (lower.startsWith('/task status ')) return this.taskStatus(line.slice(13).trim());
    if (lower === '/review today' || lower === '/review' || lower === '/review daily') return { text: this.dailyReview ? await this.dailyReview.render({ memory: this.memory, actionJournal: this.phase3?.journal }) : 'Local development review is not configured.' };
    if (lower === '/devlog' || lower === '/devlog help') return { text: 'Use /devlog done <completed work>, /devlog blocker <problem>, /devlog next <planned action>, /devlog list. Entries are explicitly user-reported, not independently verified.' };
    if (lower === '/devlog list') return { text: this.dailyReview ? this.dailyReview.list().slice(-30).map(e => `[${e.id}] ${e.type}: ${e.text} (user reported)`).join('\n') || 'No development log entries.' : 'Development log is unavailable.' };
    if (/^\/devlog (?:done|blocker|next)\s+/i.test(line)) {
      if (!this.dailyReview) return { text: 'Development log is unavailable.' };
      const found = line.match(/^\/devlog (done|blocker|next)\s+(.+)$/is);
      const item = await this.dailyReview.add(found[1].toLowerCase(), found[2]);
      return { text: `Recorded user-reported ${item.type} [${item.id}]. This is not independently verified.` };
    }
    if (lower === '/accuracy') return { text: 'Echo accuracy policy: saved records and arithmetic must use deterministic tools. Generated programming and factual responses remain unverified. Use npm run test:record and npm run evaluate in Ubuntu, then /review today. No measured score guarantees arbitrary LLM correctness.' };

    if (lower.startsWith('/task add ')) return this.addTask(line.slice(10));
    if (lower.startsWith('/task done ')) return this.finish(line.slice(11));
    if (lower === '/task add' || lower === '/task done') return { text: 'Usage: /task add <text> | /task done <ID or description>' };
    if (lower === '/routine' || lower === '/today') return { text: briefing({ profile: this.profileState.profile, memory: this.memory, calendar: this.calendar, now: this.clock(), timeZone: this.timeZone }) };
    if (lower === '/event' || lower === '/event list') return { text: formatEvents(this.calendar.list(), this.timeZone) };
    if (lower.startsWith('/event add ')) {
      const found = line.slice(11).match(/^(\S+)\s*\|\s*(.+)$/);
      if (!found) return { text: 'Usage: /event add 2026-11-01T09:00+03:00 | Event title' };
      const event = await this.calendar.add(found[1], found[2]);
      return { text: `Saved local event [${event.id}] for ${event.at}: ${event.title}. Alerts are only checked while Echo is open.` };
    }
    if (lower.startsWith('/event delete ')) {
      const id = line.slice(14).trim();
      return { text: await this.calendar.remove(id) ? `Deleted local event [${id}].` : `Event [${id}] not found.` };
    }
    if (lower === '/brief morning' || lower === '/brief evening') return { text: briefing({ period: lower.split(' ')[1], profile: this.profileState.profile, memory: this.memory, calendar: this.calendar, now: this.clock(), timeZone: this.timeZone }) };
    if (lower === '/summarize notes') return { text: summarizeText(this.memory.listNotes().map(n => n.text).join('. ') || 'No notes saved.') };
    if (lower.startsWith('/summarize ')) return { text: summarizeText(line.slice(11)) };
    if (lower.startsWith('/decide ')) return this.chat(decisionPrompt(line.slice(8)), onToken);
    if (lower === '/voice' || lower === '/voice status') return { text: `${this.voice?.status() ?? 'Offline voice provider not configured.'}\nSpoken replies this session: ${this.voiceReplies ? 'ON' : 'OFF'}.`, announcement: true };
    if (lower === '/voice setup') return { text: voiceSetup({ status: this.voice?.status() || '' }), announcement: true };
    if (lower === '/voice check') return { text: this.voice ? await this.voice.check() : 'Voice provider is unavailable.', announcement: true };
    if (lower === '/voice test') {
      if (!this.voice) return { text: 'Voice provider is unavailable.', announcement: true };
      await this.voice.speak('This is Echo. If you can hear this message, local text to speech playback is working.');
      return { text: 'Test playback command finished. If no sound was audible, check Ubuntu volume and output device.', announcement: true };
    }
    if (lower === '/voice on') return this.enableVoice();
    if (lower === '/voice off') { this.voiceReplies = false; return { text: 'Voice replies disabled. Echo will continue in text.', announcement: true }; }
    if (lower === '/voice reply' || lower === 'read your last answer aloud' || lower === 'say that aloud') {
      if (!this.lastOutput) return { text: 'There is no previous response to speak.', announcement: true };
      await this.voice.speak(this.lastOutput);
      return { text: 'Finished speaking the previous response.', announcement: true };
    }
    if (/^\/voice (?:ask|chat)(?:\s|$)/.test(lower)) {
      const chat = lower.startsWith('/voice chat');
      const parts = line.split(/\s+/);
      const seconds = parts.length === 2 ? 5 : Number(parts[2]);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) return { text: 'Recording duration must be 1–30 seconds.', announcement: true };
      return this.hearAndAnswer(seconds, { speak: chat, onToken });
    }
    if (lower.startsWith('/voice transcribe ')) return { text: `Transcription: ${await this.voice.transcribe(line.slice(18).trim())}`, announcement: true };
    if (lower === '/voice listen' || lower.startsWith('/voice listen ')) {
      const seconds = lower === '/voice listen' ? 5 : Number(line.slice(14).trim());
      const transcript = await this.voice.listen({ seconds });
      return { text: `Transcription: ${transcript}\nUse /voice ask 5 to send speech to Echo for an answer.`, announcement: true };
    }
    if (lower === '/voice speak' || lower.startsWith('/voice speak ')) {
      const utterance = lower === '/voice speak' ? this.lastOutput : line.slice(13).trim();
      await this.voice.speak(utterance);
      return { text: 'Finished local speech playback.', announcement: true };
    }
    if (this.phase3) {
      const action = await this.phase3.handle(line);
      if (action) return action;
    }
    if (this.phase2) {
      const action = await this.phase2.handle(line);
      if (action?.askModel) return this.chat(action.askModel, onToken);
      if (action) return action;
    }
    if (line.startsWith('/')) return { text: 'Unknown command. Use /help for the actual supported commands.' };
    const intent = parseIntent(line);
    if (intent?.type === 'remember') return this.remember(intent.text);
    if (intent?.type === 'clarifyMemory') return { text: 'Tell me exactly what to save: /remember <text>' };
    if (intent?.type === 'completeTask') return this.finish(intent.reference);
    if (intent?.type === 'addTask') {
      const result = await this.addTask(intent.text);
      if (intent.reminderUnsupported) result.text += '\nSaved as a task only; Echo did not schedule a notification.';
      return result;
    }
    if (intent?.type === 'suggestTask') {
      if (!this.phase3) return { text: 'Would you like me to save that as a task? Say: add a task to ' + intent.text };
      const item = await this.phase3.journal.propose('add-task', `Add task: ${intent.text.slice(0, 180)}`, { text: intent.text });
      return { text: this.phase3.proposalText(item) };
    }
    if (intent?.type === 'deleteTask' || intent?.type === 'deleteNote') {
      if (!this.phase3) return { text: 'Delete operations require Phase 3 approval controls.' };
      return this.phase3.handle(`${intent.type === 'deleteTask' ? '/task' : '/note'} delete ${intent.id}`);
    }
    if (intent?.type === 'unsupportedExternal') return { text: 'Echo cannot send messages, emails, or calls in this release. Nothing was sent or scheduled.' };
    if (intent?.type === 'math') {
      if (parseBaseConversion(line) !== null) this.lastVerifiedConversion = intent.result;
      else this.lastVerifiedConversion = null;
      const match = intent.result.match(/^(\d+) \+ (\d+) = (\d+) \(decimal\)[\s\S]*?Verification: ([01]+)₂/);
      this.lastMathPlain = match ? `${match[1]} + ${match[2]} = ${match[3]}₁₀ = ${match[4]}₂.` : intent.result;
      return { text: intent.result };
    }
    if (intent?.type === 'timeoutInfo') return { text: timeoutExplanation({ timeoutMs: this.session.provider?.timeoutMs }) };
    if (intent?.type === 'voiceHelp') return { text: voiceSetup({ status: this.voice?.status() || '' }) };
    if (intent?.type === 'voiceRequest') return this.enableVoice();
    if (intent?.type === 'voiceStatus') return this.process('/voice status');
    if (intent?.type === 'javascriptDate') return { text: javascriptDateExplanation(this.dateTime()) };
    if (intent?.type === 'identity') return { text: this.identity() };
    if (intent?.type === 'capabilities') return { text: capabilitySummary() };
    if (intent?.type === 'datetime') return { text: this.dateTime() };
    if (intent?.type === 'listTasks') return { text: formatTasks(this.memory.listTasks()) };
    if (intent?.type === 'pendingTasks') return { text: `Pending (incomplete) tasks:\n${this.memory.listTasks({ includeDone: false }).length ? formatTasks(this.memory.listTasks({ includeDone: false })) : 'No incomplete tasks.'}` };
    if (intent?.type === 'completedTasks') return { text: `Completed tasks:\n${this.memory.listTasks().some(t => t.done) ? formatTasks(this.memory.listTasks().filter(t => t.done)) : 'No completed tasks.'}` };
    if (intent?.type === 'nextTask') {
      const pending = this.memory.listTasks({ includeDone: false });
      return { text: pending.length ? `First outstanding saved task (not ranked by urgency): [${pending[0].id}] ${pending[0].text}. Tell me its priority if you want a recommendation based on importance.` : 'No incomplete tasks. I cannot infer unfinished work outside saved tasks.' };
    }
    if (intent?.type === 'taskStatus') return this.taskStatus(intent.reference);
    if (intent?.type === 'taskDefinition') return { text: 'Correct. Pending tasks are saved tasks that have not been marked complete. I will use that definition for task queries. 🙂' };
    if (intent?.type === 'dailyReview') return { text: this.dailyReview ? await this.dailyReview.render({ memory: this.memory, actionJournal: this.phase3?.journal }) : 'The development review is not configured.' };

    if (intent?.type === 'listNotes') return { text: formatNotes(this.memory.listNotes()) };
    if (intent?.type === 'listEvents') return { text: formatEvents(this.calendar.list(), this.timeZone) };
    if (intent?.type === 'help') return { text: HELP };
    if (intent?.type === 'memoryInfo') return { text: 'Notes and tasks are stored locally in data/echo-memory.json. Calendar entries are stored in data/echo-calendar.json. Search uses local embeddings with a keyword fallback. Ordinary chat does not train the model or automatically persist.' };
    if (intent?.type === 'routine') return { text: briefing({ profile: this.profileState.profile, memory: this.memory, calendar: this.calendar, now: this.clock(), timeZone: this.timeZone }) };
    const fact = programmingFact(line, { previousAnswer: this.lastAnswer });
    if (fact) return { text: fact };
    return this.chat(line, onToken);
  }
  taskStatus(reference) {
    const result = this.memory.taskByReference(reference);
    if (result.status === 'missing') return { text: `No saved task matches "${reference}". No completion was inferred.` };
    if (result.status === 'ambiguous') return { text: `Several saved tasks match "${reference}":\n${result.matches.map(t => `[${t.id}] ${t.text}`).join('\n')}\nUse the ID to check a specific task.` };
    const task = result.task;
    return { text: `Task [${task.id}] ${task.text}: ${task.done ? 'completed' : 'pending (incomplete)'}.` };
  }
  async prepareSingleSpeech() {
    if (!this.voice) return { text: 'Voice provider is unavailable.', announcement: true };
    try { await this.voice.requireOutput(); return null; }
    catch (error) { return { text: `Cannot speak this response: ${error.message}`, announcement: true }; }
  }
  identity() { return `${this.profileState.profile?.displayName || 'The user'} is the human creator and operator of Echo. Echo is a software AI assistant, not the human.`; }
  diagnostics() {
    const provider = this.session.provider || {};
    return [
      `Local model: ${this.model}. Embeddings: ${this.embeddingModel}.`,
      `Timeout: ${Math.round((provider.timeoutMs || 180000) / 1000)} seconds. Output cap: ${provider.maxOutputTokens ?? 'unspecified'} tokens. Context: ${provider.numCtx ?? 'unspecified'} tokens.`,
      `Voice: ${this.voice?.status() || 'not configured'} Spoken replies this session: ${this.voiceReplies ? 'ON' : 'OFF'}.`,
      'The model does not have direct access to system logs, the web, or automatic package installation. Use /date, /abilities and /voice status for verified information.',
    ].join('\n');
  }
  dateTime() { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'medium', timeZone: this.timeZone }).format(this.clock()) + ` (${this.timeZone}, device clock)`; }
  async remember(text) { const { note, indexed } = await this.memory.addNote(text); return { text: `Saved note [${note.id}]: ${note.text}. ${indexed ? 'Semantic index ready.' : 'Keyword search only until indexing succeeds.'}` }; }
  async addTask(text) {
    const clean = String(text).trim();
    const duplicate = this.memory.listTasks({ includeDone: false }).find(t => t.text.toLowerCase().replace(/\s+/g, ' ').trim() === clean.toLowerCase().replace(/\s+/g, ' '));
    if (duplicate) return { text: `Already on your task list [${duplicate.id}]: ${duplicate.text}. No duplicate created.` };
    const t = await this.memory.addTask(clean);
    return { text: `Added task [${t.id}]: ${t.text}` };
  }
  async finish(reference) { return { text: formatTaskResult(await this.memory.completeTaskByReference(reference), reference) }; }
  async chat(text, onToken) {
    const followup = /\b(?:that|this|it|previous|last|in the (?:code|program)|you wrote|you just|same)\b/i.test(text);
    const ref = followup && this.lastAnswer ? this.lastAnswer.slice(0, 1200) : null;
    const answer = await this.session.reply(text, { onToken, reference: ref });
    this.lastAnswer = answer;
    return { text: answer, streamed: typeof onToken === 'function', truncated: this.session.provider.lastTruncated === true };
  }
}
