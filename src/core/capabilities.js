export function capabilitySummary() {
  return [
    'Echo v0.1.0-rc1 — currently implemented:',
    '- Local Ollama text chat, private profile, saved notes, semantic recall, local task list.',
    '- Local calendar entries, on-demand briefings, session-only due-event alerts while the CLI runs.',
    '- Verified arithmetic and binary conversion; deterministic quiz and word-chain modes.',
    '- Text extraction and action suggestions from supplied notes; option-comparison assistance.',
    '- Optional local voice transcription and speech, only when Whisper CLI, Piper and audio tools are installed and configured.',
    'Not implemented: calendar-provider sync, OS notifications when Echo is closed, telephone calls, encrypted storage, autonomous system actions or cloud access.',
    'Chat history is session-only; explicit notes and tasks persist. Local models can still be wrong.',
  ].join('\n');
}
