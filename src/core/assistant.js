import { parseIntent } from './intent.js';
import { calculateText } from './math.js';
import { capabilitySummary } from './capabilities.js';
import { formatEvents } from './calendar.js';
import { briefing } from './briefings.js';
import { summarizeText, decisionPrompt } from './summarize.js';
import { Games } from './games.js';
import { timeoutExplanation, voiceSetup, javascriptDateExplanation } from './diagnostics.js';

export const HELP = [
  'Commands: /help /menu /status /model /profile /identity /abilities /date /diagnostics /reset /continue /exit',
  'Notes: /remember <text> /notes /recall <query> /forget <note-id> /index /summarize notes',
  'Tasks: /task list /task add <text> /task done <id or description> /routine',
  'Calendar: /event list /event add 2026-11-01T09:00+03:00 | Event name /event delete <id>',
  'Routine: /brief morning /brief evening',
  'Learning: /summarize <text> /decide Option A | Option B',
  'Games: /game trivia technology /game trivia general /game wordchain /game guess /game quit',
  'Voice: /voice check /voice test /voice on /voice off /voice reply /voice speak <text> /voice listen [seconds] /voice ask [seconds] /voice chat [seconds] /voice transcribe <file.wav>',
  'Offline calendar alerts only run while this CLI remains open. No internet or messaging actions are implemented.',
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
  constructor({ session, memory, calendar, profileState, model, embeddingModel, voice = null, statusText = () => '', timeZone = 'Africa/Nairobi', clock = () => new Date() }) {
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
    this.voiceReplies = false;
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
    const change = parseIntent(transcript);
    if (transcript.startsWith('/') || ['remember', 'addTask', 'completeTask'].includes(change?.type)) {
      return { text: `I heard: ${transcript}\nThis could modify stored data or execute a command. Type it to confirm.`, heard: transcript, announcement: true };
    }
    const result = await this.process(transcript, { onToken });
    return { ...result, heard: transcript, speak: speak || result.speak };
  }
  async process(input, { onToken } = {}) {
    const line = String(input).trim();
    const lower = line.toLowerCase();
    if (!line) return { text: '' };
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
    if (line.startsWith('/')) return { text: 'Unknown command. Use /help for the actual supported commands.' };
    const intent = parseIntent(line);
    if (intent?.type === 'remember') return this.remember(intent.text);
    if (intent?.type === 'clarifyMemory') return { text: 'Tell me exactly what to save: /remember <text>' };
    if (intent?.type === 'completeTask') return this.finish(intent.reference);
    if (intent?.type === 'addTask') return this.addTask(intent.text);
    if (intent?.type === 'math') {
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
    if (intent?.type === 'listNotes') return { text: formatNotes(this.memory.listNotes()) };
    if (intent?.type === 'listEvents') return { text: formatEvents(this.calendar.list(), this.timeZone) };
    if (intent?.type === 'help') return { text: HELP };
    if (intent?.type === 'memoryInfo') return { text: 'Notes and tasks are stored locally in data/echo-memory.json. Calendar entries are stored in data/echo-calendar.json. Search uses local embeddings with a keyword fallback. Ordinary chat does not train the model or automatically persist.' };
    if (intent?.type === 'routine') return { text: briefing({ profile: this.profileState.profile, memory: this.memory, calendar: this.calendar, now: this.clock(), timeZone: this.timeZone }) };
    return this.chat(line, onToken);
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
  async addTask(text) { const t = await this.memory.addTask(text); return { text: `Added task [${t.id}]: ${t.text}` }; }
  async finish(reference) { return { text: formatTaskResult(await this.memory.completeTaskByReference(reference), reference) }; }
  async chat(text, onToken) {
    const answer = await this.session.reply(text, { onToken });
    this.lastAnswer = answer;
    return { text: answer, streamed: typeof onToken === 'function', truncated: this.session.provider.lastTruncated === true };
  }
}
