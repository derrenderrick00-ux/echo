// Phase 0 starts with a dependency-free, non-AI terminal scaffold.
// The Ollama adapter, memory, profile, retrieval and briefings are NOT implemented.
export const phase00 = Object.freeze({
  id: 0,
  name: 'Foundation: local chat and profile',
  status: 'in-progress',
});

export function phase00Help() {
  return [
    'Commands: /help  /status  /exit',
    'Text chat with a local model is planned but NOT connected yet.',
  ].join('\n');
}
