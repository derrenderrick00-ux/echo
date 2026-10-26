import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { AssistantController, HELP } from '../core/assistant.js';

export async function runCli({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, timeZone = 'Africa/Nairobi' }) {
  console.log('Echo v0.1.0-rc.3 — Phase 1 voice controls candidate');
  console.log(`Local model: ${model} | Memory embeddings: ${embeddingModel}`);
  console.log(HELP);
  if (!profileState.loaded) console.log('No private profile loaded.');
  const controller = new AssistantController({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, timeZone });
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY), prompt: 'you> ' });
  let closed = false;
  let quitting = false;
  const onClose = new Promise(resolve => rl.once('close', () => { closed = true; resolve(); }));
  rl.on('SIGINT', () => { quitting = true; rl.close(); });
  let pending = Promise.resolve();
  async function handle(line) {
    if (quitting) return;
    if (!line.trim()) return;
    let streamed = false;
    try {
      const result = await controller.answer(line, { onToken: chunk => { if (!streamed) { output.write('echo> '); streamed = true; } output.write(chunk); } });
      if (result.exit) { quitting = true; rl.close(); return; }
      if (result.streamed) { output.write('\n'); if (result.truncated) console.log('echo> Output reached the configured limit. Type /continue.'); }
      else if (result.text) console.log(`echo> ${result.text}`);
      if (result.heard) console.log(`echo> Heard: ${result.heard}`);
      if (result.speak && result.text) {
        try { await voice.speak(result.text); }
        catch (error) { console.error(`echo> Spoken reply failed: ${error.message}`); }
      }
    } catch (error) {
      if (streamed) output.write('\n');
      console.error(`echo> ${error.message}`);
    }
  }
  rl.on('line', line => { pending = pending.then(async () => { await handle(line); if (!quitting && !closed) rl.prompt(); }).catch(error => console.error(`echo> ${error.message}`)); });
  const ticker = setInterval(() => {
    pending = pending.then(async () => {
      if (quitting || closed) return;
      const due = await calendar.due();
      for (const event of due) console.log(`\necho> Local event due: [${event.id}] ${event.title}`);
      if (due.length && !closed) rl.prompt();
    }).catch(error => console.error(`echo> Calendar check failed: ${error.message}`));
  }, 30000);
  ticker.unref();
  rl.prompt();
  try { await onClose; await pending; }
  finally { clearInterval(ticker); }
}
