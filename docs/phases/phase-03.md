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

## Phase 3.1–3.5 — Integrated reliability candidate v0.3.1-rc.1

- 3.1: natural-language pending/completed task retrieval, read-only status questions, explicit approval for ambiguous study plans.
- 3.2: exact verified base-2/8/10/16 integer conversion and syntax-only JavaScript workspace checks, plus targeted C `%` and JS arrow-function explanations.
- 3.3: bounded prior-answer context for follow-up questions, with unverified AI output explicitly identified as reference rather than trusted evidence.
- 3.4: deterministic task, review, arithmetic and code-parser results; no fabricated claims of file, network or model checks.
- 3.5: private on-demand daily review, explicit development journal, locally recorded test results and curated intent-routing evaluation.

All modules have automated tests. Neither successful live voice transcription nor automatic device synchronization is established by this candidate. See `docs/PHASE31_RELIABILITY.md` and `docs/PHASE31_TEST_REPORT.md`.
