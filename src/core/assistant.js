import { parseIntent } from './intent.js';
import { calculateText } from './math.js';
import { capabilitySummary } from './capabilities.js';
import { formatEvents } from './calendar.js';
import { briefing } from './briefings.js';
import { summarizeText, decisionPrompt } from './summarize.js';
import { Games } from './games.js';

export const HELP = [
  'Commands: /help /menu /status /model /profile /identity /abilities /date /reset /continue /exit',
  'Notes: /remember <text> /notes /recall <query> /forget <note-id> /index /summarize notes',
  'Tasks: /task list /task add <text> /task done <id or description> /routine',
  'Calendar: /event list /event add 2026-11-01T09:00+03:00 | Event name /event delete <id>',
  'Routine: /brief morning /brief evening',
  'Learning: /summarize <text> /decide Option A | Option B',
  'Games: /game trivia technology /game trivia general /game wordchain /game guess /game quit',
  'Voice: /voice status /voice listen [seconds] /voice transcribe <file.wav> /voice speak <text>',
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
  }
  async answer(input, { onToken } = {}) {
    const line = String(input).trim();
    const lower = line.toLowerCase();
    if (!line) return { text: '' };
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
    if (lower === '/voice' || lower === '/voice status') return { text: this.voice?.status() ?? 'Offline voice provider not configured.' };
    if (lower.startsWith('/voice transcribe ')) return { text: `Transcription: ${await this.voice.transcribe(line.slice(18).trim())}` };
    if (lower === '/voice listen' || lower.startsWith('/voice listen ')) {
      const seconds = lower === '/voice listen' ? 5 : Number(line.slice(14).trim());
      const transcript = await this.voice.listen({ seconds });
      return { text: `Transcription: ${transcript}\nTo send this as a question, type it into the CLI. The transcript was not automatically saved.` };
    }
    if (lower === '/voice speak' || lower.startsWith('/voice speak ')) {
      const utterance = lower === '/voice speak' ? this.lastAnswer : line.slice(13).trim();
      await this.voice.speak(utterance);
      return { text: 'Finished local speech playback.' };
    }
    if (line.startsWith('/')) return { text: 'Unknown command. Use /help for the actual supported commands.' };
    const intent = parseIntent(line);
    if (intent?.type === 'remember') return this.remember(intent.text);
    if (intent?.type === 'clarifyMemory') return { text: 'Tell me exactly what to save: /remember <text>' };
    if (intent?.type === 'completeTask') return this.finish(intent.reference);
    if (intent?.type === 'addTask') return this.addTask(intent.text);
    if (intent?.type === 'math') return { text: intent.result };
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
  identity() { return `${this.profileState.profile?.displayName || 'The user'} is the human creator and operator of Echo. Echo is a software AI assistant, not the human.`; }
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
