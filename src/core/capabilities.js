export function capabilitySummary() {
  return [
    'Echo v0.3.0-rc.1 — currently implemented:',
    '- Local Ollama text chat, private profile, saved notes, semantic recall, local task list.',
    '- Local calendar entries, on-demand briefings, session-only due-event alerts while the CLI runs.',
    '- Verified arithmetic and binary conversion; deterministic quiz and word-chain modes.',
    '- Text extraction and action suggestions from supplied notes; option-comparison assistance.',
    '- On-request spoken replies (/voice on, /voice off, /voice reply), one-shot microphone questions (/voice ask 5) and two-way voice turns (/voice chat 5), requiring local Whisper, Piper and audio tools. No continuous listening or wake word.',
    '- Phase 2 candidate: private idea ratings, decision journal and explicit preferences; JavaScript generation/review uses the fallible local model. Optional /code run requires bubblewrap; never falls back to host execution.',
    '- Phase 3 candidate: natural language task entry, approval queue and local audit; optional manually transferred encrypted snapshots between explicitly trusted devices.',
    'Not implemented: calendar-provider sync, automatic device/network synchronization, deletion propagation, profile synchronization, background autonomy, telephony, cloud access, or local data encryption at rest.',
    'Chat history is session-only; explicit notes and tasks persist. Local models can still be wrong.',
  ].join('\n');
}
