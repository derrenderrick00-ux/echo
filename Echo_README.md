# Echo — Personal AI Agent

> **Status:** Phase 0 in progress · **Version:** 0.0.1 (repository scaffold, not an AI release)

Echo is a modular, **offline-first** personal AI agent intended to become a digital extension of its user. It is designed to support natural conversations, personal memory, daily routines, coding assistance, and—over time—permission-controlled autonomous actions across **Ubuntu, Windows, and Android**.

The definitive product scope and phase exit criteria are in `Echo_Master_Document.md` (maintained privately unless deliberately redacted for publication). This repository currently contains the **initial architecture and runnable CLI scaffold**. It does **not** yet provide AI conversation, semantic memory, voice, or autonomous actions.

## Principles

- **Local-first:** personal data is processed and stored on-device by default.
- **Modular:** interfaces, agent logic, memory, model adapters, and tools remain separate.
- **Permission-gated:** meaningful side effects require approval and an audit trail.
- **One capability at a time:** new phases reuse existing modules instead of replacing Echo.
- **Honest milestones:** planned features are never marked implemented without tests.

## Technology decisions

| Area | Initial choice | Status |
| --- | --- | --- |
| Core | JavaScript ES modules + Node.js 24 | Scaffold ready |
| Developer OS | Ubuntu (native installation) | Ready |
| Interface | Terminal/CLI | Skeleton ready |
| Local AI | Ollama adapter, with a small locally tested model | Planned, Phase 0 |
| Personal profile | Local JSON (example template only in Git) | Planned, Phase 0 |
| Notes and search | Local storage + embeddings/vector retrieval | Planned, Phase 0 |
| Structured data | SQLite | Planned as needs grow |
| Voice | Local STT/TTS | Phase 1 |
| Cross-device clients and sync | Android, Windows, Ubuntu | Phase 3 |
| Languages beyond JS | Python or native code only when needed | Optional |

**Hardware note:** An 8 GB RAM laptop may require a small quantized model. Ollama and the eventual model are not bundled in this repo. Performance and model compatibility still require local testing.

## Project layout

```text
echo/
├── README.md
├── package.json
├── .gitignore
├── .env.example
├── config/
│   └── profile.example.json
├── src/
│   ├── echo.js                # Single application entry point
│   ├── phases/
│   │   ├── index.js           # Phase registry
│   │   ├── phase-00.js        # Foundation (active scaffold)
│   │   ├── phase-01.js        # Offline core, routine, voice
│   │   ├── phase-02.js        # Coding, ideation, personalization
│   │   ├── phase-03.js        # Hybrid autonomy and multi-device
│   │   ├── phase-04.js        # Telephony
│   │   └── phase-05.js        # Hardening and optimization
│   ├── core/                  # Conversation orchestration and policies (future)
│   ├── interfaces/            # CLI, then other user interfaces (future)
│   ├── providers/             # Local and online model adapters (future)
│   ├── memory/                # Profiles, history, semantic retrieval (future)
│   └── tools/                 # Approval-gated capabilities (future)
├── docs/
│   ├── ARCHITECTURE.md
│   └── phases/                # Requirements and exit criteria per phase
├── tests/
└── data/                      # Local private state; ignored by Git
```

**Why phases have their own files:** `phase-XX.js` files identify what each milestone introduces and eventually wire together the necessary services. **They should not contain all the implementation code.** For example, a memory component introduced in Phase 0 stays in `src/memory/` and remains usable in later phases.

## Getting started (Ubuntu)

Prerequisites: Node.js 24+, npm, Git.

```bash
# In the root of the repository you already created:
npm install
npm start
```

Inside the prototype CLI, use `/help`, `/status`, and `/exit`. The placeholder is intentionally explicit that AI chat is **not connected**.

Check project status without entering the CLI:

```bash
npm start -- --status
```

Run the included tests:

```bash
npm test
```

> `npm install` currently installs no third-party packages. Do not install Ollama or download an AI model until choosing and testing a model appropriate for your hardware.

## Roadmap (from Echo master specification v1.3)

- [ ] **Phase 0 — Foundation:** Ollama/local LLM, structured personal profile, vector note retrieval, text conversation, on-demand daily routine summary. **Exit:** locally chat with a personalized model that retrieves notes.
- [ ] **Phase 1 — Offline core, routines & natural conversation:** multi-turn context, calendar/tasks, proactive briefings, local speech input/output, note summaries, basic decision support.
- [ ] **Phase 2 — Coding, ideation & deeper personalization:** sandboxed code execution, idea scoring, decision journal, stronger long-term memory.
- [ ] **Phase 3 — Hybrid autonomy & multi-device:** approved background agent loop, encrypted sync, online integrations, action logs.
- [ ] **Phase 4 — Telephony:** confirmed outbound calls, policy-controlled inbound calls, voice dialogue, safe fallback and testing.
- [ ] **Phase 5 — Hardening:** resource optimization, privacy/security safeguards, evaluation and long-term maintenance.

Phase details and acceptance criteria: [`docs/phases/`](docs/phases/)  
Design rationale and module boundaries: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Phase 0 progress

- [x] Choose Ubuntu as primary development environment.
- [x] Confirm Node.js, npm, Git, VS Code, and Python are available.
- [x] Establish repository scaffold and initial architecture.
- [ ] Select/install/test a local model using Ollama.
- [ ] Implement conversational input and local model adapter.
- [ ] Add a private personal profile and personality layer.
- [ ] Implement note storage and semantic search.
- [ ] Produce an on-demand daily routine summary.
- [ ] Test Phase 0 acceptance criteria.

## Privacy and security

- Never commit `.env`, `data/`, API keys, actual personal profiles, chat history, local databases, or recordings.
- `config/profile.example.json` contains **fictional placeholder values** only.
- Require explicit authorization before tool actions that send data, modify files, place calls, or access third-party accounts.
- Cloud processing and multi-device sync are **future features**, not currently available.
- Use version control for code and docs, not private agent state.

## Contributing and license

This is an early personal project. No license has been selected yet; do not assume permission to reuse the code without one.
