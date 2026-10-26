export function capabilitySummary() {
  return [
    'Echo v0.0.4 — implemented now:',
    '- Local Ollama chat and a private startup profile.',
    '- Explicit notes with persistent local storage and semantic /recall.',
    '- Manual tasks, completion, and on-demand /routine snapshots.',
    '- Deterministic arithmetic and decimal-to-binary conversions.',
    '- Clear commands, identity, and explicit natural-language note/task requests.',
    'Not implemented: calendar sync, real alarms, voice, internet browsing, phone calls, autonomous actions, and game tracking.',
    'Normal chat is NOT automatically saved. Models can be mistaken.',
  ].join('\n');
}
