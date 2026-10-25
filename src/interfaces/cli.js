import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { phase00Help } from '../phases/phase-00.js';
import { routineSummary } from '../core/routine.js';

function formatNotes(notes) {
  return notes.length ? notes.map(n => `[${n.id}] ${n.text}`).join('\n') : 'No saved notes.';
}
function formatTasks(tasks) {
  return tasks.length ? tasks.map(t => `${t.done ? '[x]' : '[ ]'} [${t.id}] ${t.text}`).join('\n')
    : 'No tasks saved. Try: /task add Study Express.js for 30 minutes';
}

export async function runCli({ session, memory, model, embeddingModel, profileState, statusText }) {
  console.log('Echo v0.0.3 — Phase 0: offline chat, saved notes, tasks and routine');
  if (!profileState.loaded) console.log('No private profile loaded. See config/profile.example.json.');
  console.log(`Local model: ${model} | Semantic memory model: ${embeddingModel}`);
  console.log(phase00Help());
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY), prompt: 'you> ' });
  rl.on('SIGINT', () => rl.close());
  try {
    rl.prompt();
    for await (const line of rl) {
      const message = line.trim();
      const command = message.toLowerCase();
      if (['/exit', '/quit', 'exit', 'quit', '/bye'].includes(command)) break;
      try {
        if (command === '/help') console.log(phase00Help());
        else if (command === '/status') console.log(statusText());
        else if (command === '/model') console.log(`Chat: ${model} | Embeddings: ${embeddingModel}`);
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
        } else if (command.startsWith('/remember ')) {
          const { note, indexed } = await memory.addNote(message.slice('/remember '.length));
          console.log(`echo> Saved note [${note.id}]. ${indexed ? 'Semantic vector indexed.' : 'Keyword search available; to enable vector indexing run: ollama pull all-minilm, then /index.'}`);
        } else if (command.startsWith('/forget ')) {
          const id = message.slice('/forget '.length).trim();
          console.log(await memory.deleteNote(id) ? `echo> Deleted note [${id}].` : `echo> Note [${id}] not found.`);
        } else if (command === '/index') {
          const result = await memory.indexNotes();
          console.log(`echo> Indexed ${result.indexed} note(s); ${result.failed} failed. If missing, run: ollama pull ${embeddingModel}`);
        } else if (command.startsWith('/recall ')) {
          const { results, mode } = await memory.searchNotes(message.slice('/recall '.length));
          console.log(`Memory search (${mode}):\n${formatNotes(results)}`);
        } else if (command === '/task list') {
          console.log(formatTasks(memory.listTasks()));
        } else if (command.startsWith('/task add ')) {
          const task = await memory.addTask(message.slice('/task add '.length));
          console.log(`echo> Added task [${task.id}]: ${task.text}`);
        } else if (command.startsWith('/task done ')) {
          const id = message.slice('/task done '.length).trim();
          console.log(await memory.completeTask(id) ? `echo> Completed task [${id}].` : `echo> Task [${id}] not found.`);
        } else if (command === '/routine' || command === '/today') {
          console.log(routineSummary({ profile: profileState.profile, memory }));
        } else if (message.startsWith('/')) {
          console.log('echo> Unknown command. Use /help.');
        } else if (message) {
          output.write('echo> ');
          let tokens = 0;
          try {
            // Ollama streaming avoids waiting for the entire answer before anything appears.
            await session.reply(message, { onToken: chunk => { tokens++; output.write(chunk); } });
            output.write('\n');
          } catch (error) {
            if (tokens) output.write('\n');
            console.error(`echo> Request failed: ${error.message}`);
          }
        }
      } catch (error) {
        console.error(`echo> ${error.message}`);
      }
      rl.prompt();
    }
  } finally { rl.close(); }
}
