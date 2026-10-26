export function capabilitySummary() {
  return [
    'Echo v0.2.0-rc.1 — currently implemented:',
    '- Local Ollama text chat, private profile, saved notes, semantic recall, local task list.',
    '- Local calendar entries, on-demand briefings, session-only due-event alerts while the CLI runs.',
    '- Verified arithmetic and binary conversion; deterministic quiz and word-chain modes.',
    '- Text extraction and action suggestions from supplied notes; option-comparison assistance.',
    '- On-request spoken replies (/voice on, /voice off, /voice reply), one-shot microphone questions (/voice ask 5) and two-way voice turns (/voice chat 5), requiring local Whisper, Piper and audio tools. No continuous listening or wake word.',
    '- Phase 2 candidate: private idea ratings, decision journal and explicit preferences; JavaScript generation/review uses the fallible local model. Optional /code run requires bubblewrap; never falls back to host execution.',
    'Not implemented: calendar-provider sync, OS notifications when Echo is closed, telephone calls, encrypted storage, autonomous system actions or cloud access.',
    'Chat history is session-only; explicit notes and tasks persist. Local models can still be wrong.',
  ].join('\n');
}
