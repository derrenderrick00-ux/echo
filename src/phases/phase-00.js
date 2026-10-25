import { ConversationSession } from '../core/conversation.js';

// Phase 0 integrates existing modules. Later phases reuse them.
export const phase00 = Object.freeze({
  id: 0,
  name: 'Foundation: local chat and profile',
  status: 'in-progress',
});

export function createPhase00({ provider, profile, maxTurns }) {
  return new ConversationSession({ provider, profile, maxTurns });
}

export function phase00Help() {
  return [
    'Commands: /help  /status  /model  /profile  /reset  /exit',
    'Type a message to speak to your local Ollama model.',
    'Chat history is session-only. Persistent memory and note retrieval are NOT implemented yet.',
  ].join('\n');
}
