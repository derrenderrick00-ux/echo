# Phase 1 — Offline Core + Routine + Conversation (Week 3–6)

**Status:** Not started  
**Source:** Echo Master Document, Part 1, §5 (specification v1.3).

## Deliverables

- [ ] Robust multi-turn conversation, history and style matching.
- [ ] Calendar/task integrations and proactive daily briefings.
- [ ] Offline speech-to-text and text-to-speech.
- [ ] Capture and summarize notes.
- [ ] Basic decision-support interactions.

## Exit criterion

Echo can converse naturally offline and manage daily routines within defined permission boundaries.

## Implementation notes

- `src/phases/phase-01.js` is the phase integration point, not the location for all logic.
- Reusable components belong in `src/core/`, `src/memory/`, `src/providers/`, `src/interfaces/`, or `src/tools/`.
- Never mark a deliverable complete merely because a placeholder exists.
