# Phase 0 — Foundation (Week 1–2 in original roadmap)

**Status:** Implementation ready; acceptance testing pending on the developer's Ubuntu device.  
**Source of requirements:** Echo Master Document, Part 1, §5, specification v1.3.

## Milestones and acceptance

- [x] **0.1:** Local Ollama installed and small model tested (developer confirmed).
- [x] **0.2:** Ollama-backed text CLI; model response verified by developer in v0.0.2.
- [x] **0.3:** Private profile loaded in v0.0.2; developer verified `/profile` and personalized priorities.
- [x] **0.4 implementation:** Explicit saved notes, persistent tasks, local vector search (all-minilm) and keyword fallback. Automated tests pass.
- [x] **0.5 implementation:** On-demand routine snapshot and test coverage; output includes saved tasks/profile goals, not invented reminders.
- [ ] **Acceptance test:** Verify memory survives restart, semantic retrieval works after pulling `all-minilm`, `/routine` reads live user tasks, and fully local operation works with networking disabled.
- [ ] **Acceptance test:** Evaluate CPU/RAM consumption on the ThinkPad X280, ensure no critical errors or corruption.

**Exit criterion from master specification:** Chat with a local model that reflects basic personal style and can retrieve notes. The routine summary must be available on request.

## Practical user test

```bash
ollama pull all-minilm
cd ~/Documents/echo
npm test
npm start
```

```text
/identity
/remember Express.js is a backend web framework I'm learning.
/notes
/recall backend framework
/task add Study Express.js for 30 minutes
/task list
/routine
/reset
/exit
```

Start Echo again and repeat `/notes`, `/task list`, `/recall backend framework`. Verify saved entries persist. To complete a task use `/task done <id>` (get ID from `/task list`). For note removal use `/forget <id>` (get ID from `/notes`).

For strict offline testing, make sure Ollama uses local models, then disconnect the network **after** downloading both models and verify a local chat and `/recall` still work.

## Observed defects in v0.0.2 and mitigations

- **Derrick/Echo identity confusion:** strengthened system identity instructions plus deterministic `/identity` and `whoami`. The model can still make mistakes.
- **Missing recent Express.js mention:** latest user message/history still sent; prompt reinforced and recent-note retrieval improved. Not a guaranteed fix for weak-model reasoning.
- **Slow CPU inference:** streaming tokens + shorter configurable responses/context; reduces perceived delay, not hardware computation cost.
- **Overclaiming abilities:** explicit reminder that conversation does not save data and tasks are not alarms.

## Deferred

- Calendar sync, reminders/notifications, local STT/TTS, richer conversation handling: **Phase 1**.
- Model fine-tuning/training, encrypted at-rest storage, system-level autonomous actions, cross-device synchronization and cloud features: **later**, with separate acceptance criteria.
