# Phase 1 — Offline Core, Routine & Natural Conversation

**Status:** Planned; begins only after Phase 0 acceptance.  
**Source:** Echo Master Document, Part 1, Section 5 (original Weeks 3–6 estimate; not a deadline).

**Goal:** A substantially more natural offline personal assistant with multi-turn dialogue, practical daily routine support, note capture and voice input/output.

## Proposed implementation milestones (consistent with master requirements)

- [ ] **1.1 — Conversation management:** intent state, clarification/correction handling, topic shifts, controlled conversational summaries, and reliable quiz/game quit controls if games are offered.
- [ ] **1.2 — Daily routine engine:** calendars and task integration with explicit permissions, robust scheduling, genuine reminders where supported, morning and evening briefings. Do not claim a reminder is scheduled without an actual scheduler.
- [ ] **1.3 — Note intelligence and decisions:** note capture and summarization, extraction of actionable tasks with review/confirmation, basic decision-support prompts.
- [ ] **1.4 — Offline voice:** local speech-to-text and text-to-speech, microphone permissions and accessibility; measure CPU usage on the ThinkPad. Support text fallback.
- [ ] **1.5 — Quality and safety acceptance:** repeatable tests across restarts, identity consistency, latency, fallback behavior, truthful capability/status reporting, and safeguarding personal data.

**Architectural principle:** Keep reusable services in `src/core/`, `src/providers/`, `src/memory/`, and `src/tools/`; `src/phases/phase-01.js` wires together new functionality rather than duplicating the Phase 0 implementation.

**Exit criterion from master specification:** coherent natural offline conversations and daily routine management autonomously *within user-defined authorization bounds*. Autonomous external actions and multi-device sync are still expanded in Phase 3.
