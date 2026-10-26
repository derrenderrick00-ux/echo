import { ConversationSession } from '../core/conversation.js';

export const phase00 = Object.freeze({
  id: 0,
  name: 'Foundation: local chat, profile, memory and routine',
  status: 'in-progress', // Remains pending until live offline acceptance test.
});

export function createPhase00({ provider, profile, memory, maxTurns }) {
  return new ConversationSession({ provider, profile, memory, maxTurns });
}

export function phase00Help() {
  return [
    'Commands: /help /status /model /profile /identity /abilities /reset /exit',
    'Memory: /remember <note>  /notes  /recall <query>  /forget <note-id>  /index',
    'Tasks: /task add <task>  /task list  /task done <id or text>  /routine',
    'Explicit requests such as "remember that ..." save notes; ordinary chat does not. /reset clears only temporary history.',
  ].join('\n');
}
