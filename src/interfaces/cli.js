import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { phase00Help } from '../phases/phase-00.js';

export async function runCli({ session, model, profileState, statusText }) {
  console.log('Echo v0.0.2 — Phase 0: local AI + personal profile');
  if (!profileState.loaded) {
    console.log('No private profile found. Copy config/profile.example.json to config/profile.json and edit it.');
  }
  console.log(phase00Help());
  const rl = createInterface({
    input, output,
    terminal: Boolean(input.isTTY),
    prompt: 'you> ',
  });
  rl.on('SIGINT', () => rl.close());
  try {
    rl.prompt();
    // Async iteration also works for piped/non-interactive input; question() can lose
    // already-buffered lines when users pipe several commands at once.
    for await (const line of rl) {
      const message = line.trim();
      const command = message.toLowerCase();
      if (['/exit', '/quit', 'exit', 'quit'].includes(command)) break;
      if (command === '/help') console.log(phase00Help());
      else if (command === '/status') console.log(statusText());
      else if (command === '/model') console.log(`Local model: ${model}`);
      else if (command === '/profile') console.log(profileState.loaded
        ? `Private profile loaded${profileState.profile.displayName ? ` for ${profileState.profile.displayName}` : ''}.`
        : 'No private profile loaded. See config/profile.example.json.');
      else if (command === '/reset') {
        session.reset();
        console.log('echo> Current conversation cleared (nothing was saved to disk).');
      } else if (message) {
        try {
          console.log('echo> Thinking locally...');
          const answer = await session.reply(message);
          console.log(`echo> ${answer}`);
        } catch (error) {
          console.error(`echo> Request failed: ${error.message}`);
        }
      }
      rl.prompt();
    }
  } finally {
    rl.close();
  }
}
