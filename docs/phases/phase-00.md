# Phase 0 — Foundation (Week 1–2)

**Status:** In progress (scaffold only)  
**Source:** Echo Master Document, Part 1, §5 (specification v1.3).

## Deliverables

- [ ] Install and validate a local LLM runtime (Ollama recommended).
- [ ] Create a private structured personal profile.
- [ ] Implement semantic/vector retrieval of notes.
- [ ] Build a working text-based conversation interface.
- [ ] Deliver a daily routine summary on demand.

## Exit criterion

The user can converse with a local model that reflects their basic style and retrieves relevant notes.

## Implementation notes

- `src/phases/phase-00.js` is the phase integration point, not the location for all logic.
- Reusable components belong in `src/core/`, `src/memory/`, `src/providers/`, `src/interfaces/`, or `src/tools/`.
- Never mark a deliverable complete merely because a placeholder exists.
