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
    'Commands: /help /status /model /profile /identity /reset /exit',
    'Memory: /remember <note>  /notes  /recall <query>  /forget <note-id>  /index',
    'Tasks: /task add <task>  /task list  /task done <task-id>  /routine',
    'Ordinary chat does NOT automatically save new memories. /reset clears only temporary chat history.',
  ].join('\n');
}
