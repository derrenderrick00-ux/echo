# Phase 0 — Foundation (Week 1–2)

**Status:** In progress. Milestones 0.2 and 0.3 implemented in code; local acceptance testing pending.  
**Source:** Echo Master Document, Part 1, §5 (specification v1.3).

## Deliverables

- [x] Install and validate local LLM runtime (Ollama). *(Developer confirmed.)*
- [x] Select and locally test a small model. *(Developer confirmed Milestone 0.1 complete.)*
- [x] Implement an Ollama provider and a real text conversation CLI. *(Code ready; live test on developer machine pending.)*
- [x] Implement private personal-profile loading and personality context. *(Code ready; populate and test your own profile.)*
- [ ] Implement persistent note storage and semantic/vector retrieval (Milestone 0.4).
- [ ] Deliver an on-demand daily routine summary (Milestone 0.5).
- [ ] Verify all Phase 0 acceptance criteria offline.

## Current commands

- `/help`: print commands
- `/status`: display the six phases
- `/model`: show model setting
- `/profile`: show whether a private profile was loaded
- `/reset`: forget current-session dialogue
- `/exit` or `exit`: quit

## Implementation notes

- `src/echo.js` is only the bootstrap entry point.
- `src/phases/phase-00.js` wires the Phase 0 conversation service.
- `src/providers/ollama.js` calls the local Ollama API (`POST /api/chat`).
- `src/core/conversation.js` keeps a bounded, **RAM-only** chat history; it is not durable memory.
- `src/memory/profile.js` reads `config/profile.json` locally; real profile data is excluded from Git.
- The model cannot yet save notes, schedule reminders, search the internet, or execute commands.
- Phase 0 remains **in progress** until semantic retrieval and on-demand routine briefing work.

## Verification

```bash
npm install
npm test
ollama list
npm start
```

Inside Echo: `/profile`, `/model`, then ask two linked questions, `/reset`, and test again.
