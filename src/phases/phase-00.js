import { ConversationSession } from '../core/conversation.js';

export const phase00 = Object.freeze({
  id: 0,
  name: 'Foundation: local chat, profile, memory and routine',
  status: 'complete',
});

export function createPhase00({ provider, profile, memory, maxTurns }) {
  return new ConversationSession({ provider, profile, memory, maxTurns });
}

export function phase00Help() {
  return 'Use /help to view the current verified commands.';
}
