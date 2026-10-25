# Echo — Local-first Personal AI Agent

**Version:** v0.0.2 · **Development phase:** 0 — Foundation · **Implemented:** Milestones 0.2 and 0.3

Echo is a modular personal AI assistant intended to become a digital extension of its user. The project aims to support offline conversation, personal memory, scheduling, coding, approved autonomous actions, and eventually cross-device functionality on Ubuntu, Windows, and Android.

> **Current reality:** Echo can converse with an installed **local Ollama model** from the terminal and incorporate a **private JSON personal profile** into its replies. Session history is kept in RAM only. Echo cannot yet save notes, retrieve them semantically, make calls, control your OS, or act autonomously.

## Stack

- **Runtime:** Node.js 24, JavaScript ES modules (no additional npm dependencies).
- **AI:** Ollama HTTP API on local loopback (`127.0.0.1:11434`), default model `llama3.2:1b`.
- **Interface:** Terminal (CLI).
- **Profile:** `config/profile.json` (private, ignored by Git).
- **Later:** Persistent notes and vector search (0.4), routine summary (0.5), voice (Phase 1), multi-device (Phase 3).

## Requirements

1. Ubuntu with Node.js 24+, npm and Git.
2. Ollama installed and running locally.
3. A locally downloaded model. For the default: `ollama pull llama3.2:1b`.

## Run on Ubuntu

```bash
cd ~/Documents/echo
npm install
cp -n .env.example .env
cp -n config/profile.example.json config/profile.json
nano config/profile.json        # Replace placeholders; never commit personal data
npm test
npm start
```

`cp -n` avoids overwriting files you already customized. The private profile is optional; if absent, Echo starts in generic mode and tells you.

### Commands inside Echo

| Command | Behavior |
| --- | --- |
| `/help` | List commands |
| `/status` | Show all phase statuses |
| `/model` | Show selected model |
| `/profile` | Confirm local profile loaded |
| `/reset` | Erase current in-memory conversation |
| `/exit` or `exit` | Quit the application |

Example interaction (illustrative):

```text
$ npm start
Echo v0.0.2 — Phase 0: local AI + personal profile
you> /profile
Private profile loaded for Example User.
you> Hi Echo, what are we working on?
echo> Thinking locally...
echo> ... (model-generated answer)
you> /exit
```

If Ollama is unavailable, run `systemctl status ollama`. If your model is missing, run `ollama pull llama3.2:1b`. Running on an 8 GB ThinkPad's CPU can result in slower responses. First execution can be especially slow.

## Project layout

```text
echo/
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── config/
│   ├── profile.example.json
│   └── profile.json          # PRIVATE; ignored by Git
├── src/
│   ├── echo.js              # Entry point
│   ├── phases/              # Phase 0–5 integration and definitions
│   ├── core/
│   │   ├── config.js
│   │   └── conversation.js
│   ├── interfaces/
│   │   └── cli.js
│   ├── memory/
│   │   └── profile.js
│   ├── providers/
│   │   └── ollama.js
│   └── tools/                # Future gated actions
├── docs/
│   ├── ARCHITECTURE.md
│   └── phases/
├── tests/
└── data/                     # Future local memory; ignored by Git
```

Phases are integration modules, not duplicates of the entire application. The main entry point remains `src/echo.js`.

## Security / privacy

- The Ollama URL is restricted to HTTP loopback (`127.0.0.1`, `localhost`, `::1`) through Echo's startup configuration.
- Requests to Ollama include your selected profile and conversation content. These are processed by the local Ollama service. Cloud models are not used by Echo's code in this release.
- In the Ollama application, disable any optional cloud processing and do not select `:cloud` models when seeking strict offline processing.
- Do not commit `.env`, `config/profile.json`, or files under `data/`. Check with `git check-ignore .env config/profile.json`.
- Do not paste API keys or passwords into your profile.
- The model's output is text only. It cannot execute the actions it may describe.

## Phase roadmap (from the project master specification)

- [ ] **Phase 0 — Foundation:** local LLM, private profile, semantic note retrieval, local text chat, on-demand routine summary.
- [ ] **Phase 1 — Offline core, routine and conversation:** multi-turn robustness, tasks/calendar, local voice, summaries.
- [ ] **Phase 2 — Coding and personalization:** code assistance with sandboxed execution, ideation, decision journal.
- [ ] **Phase 3 — Hybrid autonomy and multi-device:** action loops, consent, encrypted synchronization, online tools.
- [ ] **Phase 4 — Telephony:** consent-based call handling.
- [ ] **Phase 5 — Hardening:** performance, privacy, testing and optimization.

### Milestone status

| Milestone | Status |
| --- | --- |
| 0.1 Ollama installation and model test | Complete (confirmed by developer) |
| 0.2 Ollama provider + actual text chat | Implemented; verify live on your machine |
| 0.3 Local profile + personality prompt | Implemented; populate local profile and verify |
| 0.4 Persistent notes + semantic retrieval | Not started |
| 0.5 On-demand routine summary + acceptance tests | Not started |

See [`docs/phases/phase-00.md`](docs/phases/phase-00.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Test and commit

```bash
npm test
node src/echo.js --status
git status
git add README.md .env.example package.json package-lock.json config/profile.example.json src docs/ARCHITECTURE.md docs/phases/phase-00.md tests
git commit -m "feat: connect local Ollama chat and private profile"
git push
```

No license has been selected yet.
