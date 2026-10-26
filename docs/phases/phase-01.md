# Phase 1 — Offline Core, Routine and Conversation

**Version:** v0.1.0-rc.3. **Status:** implementation candidate; hardware acceptance incomplete.

## Milestone 1.1 — Conversation and accuracy

- [x] Deterministic date/time, real notes/tasks, identity, menu and capabilities
- [x] Accurate binary-column addition and arithmetic tool routing
- [x] Stateful trivia, guessing and word chain, with `q` quit
- [x] More configurable response tokens and `/continue`
- [ ] Verify local model accuracy and longer replies during offline live sessions

## Milestone 1.2 — Routines and calendar

- [x] Offline local calendar storage with timezone offsets
- [x] On-demand briefings from saved tasks, goals and events
- [x] In-process alert polling while the CLI remains active
- [ ] Calendar-provider sync and operating-system notifications when Echo is closed
- [ ] Approved proactive briefing schedule and delivery

## Milestone 1.3 — Notes and decision support

- [x] Persistent explicit notes and semantic recall
- [x] Extractive summary and action phrase detection for supplied text
- [x] LLM option comparison with an uncertainty instruction
- [ ] Verified high-quality summarization of long files and voice recordings

## Milestone 1.4 — Local voice

- [x] Optional Whisper CLI WAV transcription, microphone capture and Piper speech playback adapters
- [x] Missing-model and unavailable-tool errors
- [x] On-demand spoken reply, voice input-to-text, one-shot two-way voice chat and session speech mode in the CLI
- [x] Local path/executable preflight checks and typed confirmation for transcribed changes
- [ ] Real target-device installation, microphone, speaker, CPU and quality tests
- [ ] Hands-free continuous listening, wake-word recognition and speech interruption handling

## Milestone 1.5 — Reliability and optimization

- [x] Mocked unit/integration tests, calendar fake-clock checks, CLI regression tests
- [x] Public-master privacy split and private local data exclusions
- [ ] Complete real offline device acceptance, performance reporting and extended failure tests
- [ ] Harden storage encryption and permissions before sensitive deployment

Phase 1 must not be described as complete until the master document's exit criteria and the relevant target-device acceptance tests have passed.
