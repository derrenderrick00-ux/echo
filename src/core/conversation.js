import { makeSystemPrompt } from '../memory/profile.js';

export class ConversationSession {
  constructor({ provider, profile = null, maxTurns = 8 }) {
    if (!provider || typeof provider.chat !== 'function') throw new Error('A chat provider is required.');
    this.provider = provider;
    this.profile = profile;
    this.maxTurns = maxTurns;
    this.history = [];
  }

  async reply(message) {
    const content = message.trim();
    if (!content) throw new Error('Message is empty.');
    const messages = [
      { role: 'system', content: makeSystemPrompt(this.profile) },
      ...this.history,
      { role: 'user', content },
    ];
    // Only record completed exchanges; a failed request must not corrupt history.
    const answer = await this.provider.chat(messages);
    this.history.push({ role: 'user', content }, { role: 'assistant', content: answer });
    this.history = this.history.slice(-(this.maxTurns * 2));
    return answer;
  }

  reset() {
    this.history = [];
  }
}
