# Phase 4 — Telephony (Week 15–20)

**Status:** Not started  
**Source:** Echo Master Document, Part 1, §5 (specification v1.3).

## Deliverables

- [ ] Outbound calling after explicit approval.
- [ ] Inbound handling constrained by user policy.
- [ ] STT/LLM/TTS voice call loop.
- [ ] Safe fallback and human takeover.
- [ ] Latency, consent, noise and reliability tests.

## Exit criterion

Echo can conduct limited, approved calls in tested scenarios with transparent control.

## Implementation notes

- `src/phases/phase-04.js` is the phase integration point, not the location for all logic.
- Reusable components belong in `src/core/`, `src/memory/`, `src/providers/`, `src/interfaces/`, or `src/tools/`.
- Never mark a deliverable complete merely because a placeholder exists.
