import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { AssistantController, HELP } from '../core/assistant.js';

export async function runCli({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, phase2Workspace = null, codeSandbox = null, actionJournal = null, manualSync = null, dailyReview = null, fileWorkspace = null, learningJournal = null, privateContext = null, progressInterview = null, timeZone = 'Africa/Nairobi' }) {
  console.log('Echo v0.3.4-rc.1 — Private file creation, context and guided progress interview');
  console.log(`Local model: ${model} | Memory embeddings: ${embeddingModel}`);
  console.log(HELP);
  if (!profileState.loaded) console.log('No private profile loaded.');
  const controller = new AssistantController({ session, memory, calendar, model, embeddingModel, profileState, statusText, voice, phase2Workspace, codeSandbox, actionJournal, manualSync, dailyReview, fileWorkspace, learningJournal, privateContext, progressInterview, timeZone });
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY), prompt: 'you> ' });
  let closed = false;
  let quitting = false;
  const onClose = new Promise(resolve => rl.once('close', () => { closed = true; resolve(); }));
  rl.on('SIGINT', () => { quitting = true; rl.close(); });
  let pending = Promise.resolve();
  let paste = null;
  let capturingSecret = false;
  async function maskedQuestion(label) {
    if (!input.isTTY || !output.isTTY) throw new Error('Secret setup/unlock requires an interactive terminal; never type the secret in chat or a shell argument.');
    output.write(`echo> ${label} (input hidden; press Enter): `);
    const original = rl._writeToOutput;
    capturingSecret = true;
    rl._writeToOutput = () => {};
    try { return await new Promise(resolve => rl.question('', answer => resolve(answer))); }
    finally { rl._writeToOutput = original; capturingSecret = false; output.write('\n'); }
  }
  async function handle(line) {
    if (quitting) return;
    if (paste) {
      if (line === ':cancel') { paste = null; console.log('echo> Paste cancelled; no files written.'); return; }
      if (line === ':end') {
        const { name, lines } = paste;
        paste = null;
        try {
          if (!fileWorkspace) throw new Error('File workspace unavailable.');
          const item = await fileWorkspace.stage([{ name, content: lines.join('\n') + '\n' }]);
          console.log(`echo> ${controller.fileCommands.describe(item)}`);
        } catch (error) { console.error(`echo> Paste rejected: ${error.message}`); }
        return;
      }
      paste.lines.push(line);
      paste.bytes += Buffer.byteLength(line, 'utf8') + 1;
      if (paste.bytes > 48 * 1024) { paste = null; console.error('echo> Paste over 48 KiB; discarded without saving.'); }
      return;
    }
    if (!line.trim()) return;
    let streamed = false;
    const needsModel = !line.trim().startsWith('/');
    const waitNotice = Boolean(input.isTTY && needsModel) ? setTimeout(() => { if (!streamed) console.log('echo> Waiting for a local response. If this persists, check Ollama and free RAM in another terminal.'); }, 12000) : null;
    try {
      const result = await controller.answer(line, { onToken: chunk => { if (waitNotice) clearTimeout(waitNotice); if (!streamed) { output.write('echo> '); streamed = true; } output.write(chunk); } });
      if (result.exit) { quitting = true; rl.close(); return; }
      if (result.secretAction) {
        if (!progressInterview) throw new Error('Private interview is unavailable.');
        const secret = await maskedQuestion(result.secretAction === 'setup' ? 'Choose an interview combination' : 'Enter interview combination');
        if (result.secretAction === 'setup') {
          const repeated = await maskedQuestion('Repeat the combination');
          if (secret !== repeated) throw new Error('Combinations did not match. No configuration saved.');
          console.log(`echo> ${await progressInterview.setup(secret)}`);
        } else console.log(`echo> ${progressInterview.unlock(secret)}`);
        return;
      }
      if (result.paste) paste = { name: result.paste, lines: [], bytes: 0 };
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
  rl.on('line', line => { if (capturingSecret) return; pending = pending.then(async () => { await handle(line); if (!quitting && !closed) rl.prompt(); }).catch(error => console.error(`echo> ${error.message}`)); });
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
