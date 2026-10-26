import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { phase00Help } from '../phases/phase-00.js';
import { routineSummary } from '../core/routine.js';
import { parseIntent } from '../core/intent.js';
import { capabilitySummary } from '../core/capabilities.js';

function formatNotes(notes) {
  return notes.length ? notes.map(n => `[${n.id}] ${n.text}`).join('\n') : 'No saved notes.';
}
function formatTasks(tasks) {
  return tasks.length ? tasks.map(t => `${t.done ? '[x]' : '[ ]'} [${t.id}] ${t.text}`).join('\n')
    : 'No tasks saved. Try: /task add Study Express.js for 30 minutes';
}
function taskResult(result, reference) {
  if (result.status === 'completed') return `echo> Completed task [${result.task.id}]: ${result.task.text}`;
  if (result.status === 'already-done') return `echo> Already completed: [${result.task.id}] ${result.task.text}`;
  if (result.status === 'ambiguous') {
    return 'echo> Multiple tasks match; use the correct ID:\n' +
      result.matches.map(t => `[${t.id}] ${t.text}`).join('\n');
  }
  return `echo> No open task matches "${reference}". Use /task list to view exact descriptions and IDs.`;
}

export async function runCli({ session, memory, model, embeddingModel, profileState, statusText }) {
  console.log('Echo v0.0.4 — Phase 0 reliability candidate');
  if (!profileState.loaded) console.log('No private profile loaded. See config/profile.example.json.');
  console.log(`Local model: ${model} | Semantic memory model: ${embeddingModel}`);
  console.log(phase00Help());
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY), prompt: 'you> ' });
  let closed = false;
  let quitting = false;
  const onClose = new Promise(resolve => rl.once('close', () => { closed = true; resolve(); }));
  rl.on('SIGINT', () => { quitting = true; rl.close(); });

  async function saveNote(noteText) {
    const { note, indexed } = await memory.addNote(noteText);
    console.log(`echo> Saved note [${note.id}]. ${indexed ? 'Semantic vector indexed.' : 'Keyword search available. To index later, run /index.'}`);
  }
  async function finish(reference) {
    console.log(taskResult(await memory.completeTaskByReference(reference), reference));
  }
  async function handle(line) {
    const message = line.trim();
    const command = message.toLowerCase();
    if (['/exit', '/quit', 'exit', 'quit', '/bye'].includes(command)) {
      quitting = true;
      rl.close();
      return;
    }
    try {
      if (command === '/help') console.log(phase00Help());
      else if (command === '/status') console.log(statusText());
      else if (command === '/model') console.log(`Chat: ${model} | Embeddings: ${embeddingModel}`);
      else if (command === '/abilities' || command === '/capabilities') console.log(capabilitySummary());
      else if (command === '/profile') console.log(profileState.loaded
        ? `Private profile loaded${profileState.profile.displayName ? ` for ${profileState.profile.displayName}` : ''}.`
        : 'No private profile loaded. See config/profile.example.json.');
      else if (command === '/identity' || command === 'whoami' || command === 'who am i' ||
               command === 'who am i?' || command === 'who is derrick' || command === 'who is derrick?') {
        const name = profileState.profile?.displayName || 'The user';
        console.log(`${name} is the human owner and creator of Echo. Echo is the AI assistant, not the human.`);
      } else if (command === '/reset') {
        session.reset();
        console.log('echo> Temporary chat history cleared. Saved notes and tasks remain on disk.');
      } else if (command === '/notes') {
        console.log(formatNotes(memory.listNotes()));
      } else if (command === '/remember' || command === '/recall' || command === '/forget') {
        console.log(`echo> Usage: ${command} <${command === '/remember' ? 'note text' : command === '/recall' ? 'search query' : 'note-id'}>`);
      } else if (command.startsWith('/remember ')) {
        await saveNote(message.slice('/remember '.length));
      } else if (command.startsWith('/forget ')) {
        const id = message.slice('/forget '.length).trim();
        console.log(await memory.deleteNote(id) ? `echo> Deleted note [${id}].` : `echo> Note [${id}] not found.`);
      } else if (command === '/index') {
        const result = await memory.indexNotes();
        console.log(`echo> Indexed ${result.indexed} note(s); ${result.failed} failed. If missing, run: ollama pull ${embeddingModel}`);
      } else if (command.startsWith('/recall ')) {
        const { results, mode } = await memory.searchNotes(message.slice('/recall '.length));
        console.log(`Memory search (${mode}):\n${formatNotes(results)}`);
      } else if (command === '/task' || command === '/task done' || command === '/task add') {
        console.log('echo> Usage: /task list | /task add <description> | /task done <task-id or description>');
      } else if (command === '/task list') {
        console.log(formatTasks(memory.listTasks()));
      } else if (command.startsWith('/task add ')) {
        const task = await memory.addTask(message.slice('/task add '.length));
        console.log(`echo> Added task [${task.id}]: ${task.text}`);
      } else if (command.startsWith('/task done ')) {
        await finish(message.slice('/task done '.length).trim());
      } else if (command === '/routine' || command === '/today') {
        console.log(routineSummary({ profile: profileState.profile, memory }));
      } else if (message.startsWith('/')) {
        console.log('echo> Unknown command. Use /help.');
      } else if (message) {
        const intent = parseIntent(message);
        if (intent?.type === 'remember') await saveNote(intent.text);
        else if (intent?.type === 'clarifyMemory') {
          console.log('echo> Please provide the exact information to save: /remember <note text>');
        } else if (intent?.type === 'completeTask') await finish(intent.reference);
        else if (intent?.type === 'addTask') {
          const task = await memory.addTask(intent.text);
          console.log(`echo> Added task [${task.id}]: ${task.text}`);
        } else if (intent?.type === 'math') console.log(`echo> ${intent.result}`);
        else if (intent?.type === 'identity') {
          const name = profileState.profile?.displayName || 'The user';
          console.log(`${name} is the human owner and creator of Echo. Echo is the AI assistant, not the human.`);
        } else if (intent?.type === 'capabilities') console.log(capabilitySummary());
        else {
          output.write('echo> ');
          let tokens = 0;
          try {
            await session.reply(message, { onToken: chunk => { tokens++; output.write(chunk); } });
            output.write('\n');
          } catch (error) {
            if (tokens) output.write('\n');
            console.error(`echo> Request failed: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`echo> ${error.message}`);
    }
  }

  // Queue all lines before handling. Crucially, a piped stdin may close while an
  // embedding/LLM request is running: readline's async iterator could lose lines
  // or attempt to prompt after close. This queue processes every received line.
  let pending = Promise.resolve();
  rl.on('line', line => {
    pending = pending.then(async () => {
      if (quitting) return;
      await handle(line);
      if (!quitting && !closed) rl.prompt();
    }).catch(error => console.error(`echo> Unexpected CLI error: ${error.message}`));
  });
  rl.prompt();
  await onClose;
  await pending;
}
