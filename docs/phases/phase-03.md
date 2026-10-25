# Phase 3 — Hybrid Autonomy & Multi-Device (Week 11–14)

**Status:** Not started  
**Source:** Echo Master Document, Part 1, §5 (specification v1.3).

## Deliverables

- [ ] Background Planner → Executor → Reflector loop.
- [ ] End-to-end encrypted synchronization of approved data.
- [ ] Opt-in online services and APIs.
- [ ] Comprehensive audit logs, approvals, and kill switch.

## Exit criterion

Echo can act across devices with clear permission controls and minimal necessary cloud use.

## Implementation notes

- `src/phases/phase-03.js` is the phase integration point, not the location for all logic.
- Reusable components belong in `src/core/`, `src/memory/`, `src/providers/`, `src/interfaces/`, or `src/tools/`.
- Never mark a deliverable complete merely because a placeholder exists.
