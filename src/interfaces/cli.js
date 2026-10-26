import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { AssistantController, HELP } from '../core/assistant.js';

export async function runCli({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, phase2Workspace = null, codeSandbox = null, actionJournal = null, manualSync = null, timeZone = 'Africa/Nairobi' }) {
  console.log('Echo v0.3.0-rc.1 — Phase 3 permissioned actions and manual sync');
  console.log(`Local model: ${model} | Memory embeddings: ${embeddingModel}`);
  console.log(HELP);
  if (!profileState.loaded) console.log('No private profile loaded.');
  const controller = new AssistantController({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, phase2Workspace, codeSandbox, actionJournal, manualSync, timeZone });
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
    const needsModel = !line.trim().startsWith('/');
    const waitNotice = Boolean(input.isTTY && needsModel) ? setTimeout(() => { if (!streamed) console.log('echo> Waiting for a local response. If this persists, check Ollama and free RAM in another terminal.'); }, 12000) : null;
    try {
      const result = await controller.answer(line, { onToken: chunk => { if (waitNotice) clearTimeout(waitNotice); if (!streamed) { output.write('echo> '); streamed = true; } output.write(chunk); } });
      if (result.exit) { quitting = true; rl.close(); return; }
      if (result.streamed) { output.write('\n'); if (result.truncated) console.log('echo> Output reached the configured limit. Type /continue.'); }
      else if (result.text) console.log(`echo> ${result.text}`);
      if (result.heard) console.log(`echo> Heard: ${result.heard}`);
      if (result.speak && result.text) {
        try {
          console.log('echo> Generating and playing voice audio...');
          await voice.speak(result.text);
          console.log('echo> Voice playback finished.');
        } catch (error) {
          if (result.activationSpeech) controller.voiceReplies = false;
          console.error(`echo> Spoken reply failed: ${error.message}${result.activationSpeech ? '. Voice mode was not enabled.' : ''}`);
        }
      }
    } catch (error) {
      if (streamed) output.write('\n');
      console.error(`echo> ${error.message}`);
      if (controller.voiceReplies && /Ollama.*(?:timed out|timeout|cannot reach)|Cannot reach local Ollama/i.test(error.message)) {
        try {
          console.log('echo> Attempting a spoken error message...');
          await voice.speak('The local language model did not respond. Please check Ollama and available memory.');
        } catch (voiceError) {
          console.error(`echo> Could not speak the error message: ${voiceError.message}`);
        }
      }
    } finally {
      if (waitNotice) clearTimeout(waitNotice);
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
