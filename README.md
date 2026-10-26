# Echo — Local-First Personal AI Agent

**Version:** `0.2.0-rc.1` | **Phase 0:** baseline complete | **Phase 1:** acceptance pending | **Phase 2:** coding, ideation and decision journal under development.

Echo is a modular offline-first AI assistant running its local conversational model through Ollama. The public repository contains no populated personal profile. The owner is a human, and Echo is a software agent.


## Phase 2 coding, ideation and decision journal — v0.2.0-rc.1

This additive update preserves the working Phase 0/1 features and introduces private idea ratings (`/idea`), an explicit decision/outcome journal (`/decision`), selected preferences (`/preference`), and user-initiated JavaScript review and generation (`/code`). Run `/phase2 help` for verified commands and `/resources` to see current Linux memory pressure.

Ideas, decisions and preferences persist to the Git-ignored `data/echo-phase2.json`. Code files must be placed in the private `data/code-workspace/` folder. Generative coding suggestions are not verified, not run, and may contain mistakes. Explicit preferences are passed to Ollama in limited context; model weights are not retrained.

**Sandbox execution is disabled by default.** Ubuntu security advisories and kernel namespace policies must be reviewed before enabling it on a supported host. Even when explicitly enabled, code uses bubblewrap in a separate namespace with a deadline and output limit; failure to initialize isolation refuses execution without an unsafe fallback. Do not treat this as a proof of resistance to malicious programs.

Read `docs/PHASE2_PLAN.md`, `docs/PHASE2_ACCEPTANCE.md` and `docs/PHASE2_TEST_REPORT.md` before marking any Phase 2 milestone complete. For development on the 8 GB ThinkPad, close heavy apps and consider the 1B local model when available RAM is low; `/resources` reports memory available, not a guarantee of inference speed.

## Implemented

- Local Ollama conversations, private startup profile, explicit persistent notes, keyword and semantic search, task management.
- Deterministic arithmetic, decimal-to-binary conversion and step-by-step binary addition, plus a host-clock date/time command.
- Exact menu, capabilities and task/note queries from application state instead of invented model responses.
- A local calendar with timezone-qualified event dates, saved event persistence and due-event checks while Echo's CLI is running.
- On-demand morning and evening briefings derived from saved profile goals, tasks and local calendar entries.
- Extractive note summarization and structured decision-comparison prompts; a model's recommendation is not independently verified.
- Stateful trivia, word chain and number guessing with `q` to quit.
- Optional local Whisper CLI transcription and Piper speech output adapters, requiring separately installed binaries and voice models.
- A higher configurable response token budget and `/continue` for long answers.

## Not yet implemented or validated

External calendar-provider synchronization, operating-system notifications while Echo is closed, background proactive briefings, native Android/Windows apps, E2E sync, phone calls, privileged autonomy, encryption-at-rest, or guaranteed LLM factual correctness. The voice adapters are **not operational** until their binaries and models are installed and verified on your computer. Phase 1 remains **in-progress** until those tests and the rest of the master specification's exit criteria pass.

## Install on the existing Ubuntu repository

Back up your private files before applying the patch. Do not remove `.git`, `.env`, `config/profile.json`, `data/`, or old notes.

```bash
cd ~/Documents/echo
mkdir -p ~/Documents/echo-private-backups/phase1
cp -a data config/profile.json .env ~/Documents/echo-private-backups/phase1/
unzip -o ~/Downloads/echo-phase1-v0.1.0-rc1-update.zip -d .
npm install
npm test
npm start
```

Requires Node.js 24, npm, Ollama locally available at `127.0.0.1:11434`, and already downloaded local models such as `llama3.2:3b` and `all-minilm`. `npm install` has no new third-party dependencies. Your private `.env` remains unchanged; add any new keys manually from `.env.example`.

Accuracy-first *testing* configuration:

```dotenv
ECHO_MODEL_PROVIDER=ollama
ECHO_OLLAMA_URL=http://127.0.0.1:11434
ECHO_OLLAMA_MODEL=llama3.2:3b
ECHO_EMBED_MODEL=all-minilm
ECHO_MAX_TURNS=4
ECHO_MAX_OUTPUT_TOKENS=768
ECHO_CONTEXT_TOKENS=4096
ECHO_TIME_ZONE=Africa/Nairobi
```

Increasing output tokens can reduce abrupt explanations but increases inference time. A 3B model can still make mistakes; exact calculations and saved-state operations should use dedicated code paths rather than model guesses.

## Commands

| Command | Purpose |
| --- | --- |
| `/help`, `/menu` | Show actual supported commands |
| `/abilities`, `/date`, `/identity`, `/status`, `/model` | Verified state and diagnostics |
| `/remember <note>`, `/notes`, `/recall <query>`, `/forget <id>` | Explicit persistent memory |
| `/task add <text>`, `/task list`, `/task done <id or text>` | Tasks |
| `/event add 2026-11-01T09:00+03:00 \| Review algorithms` | Store a timezone-aware local appointment |
| `/event list`, `/event delete <id>` | Read/delete local calendar entries |
| `/brief morning`, `/brief evening`, `/routine` | Manual routine briefings |
| `/summarize <text>`, `/summarize notes` | Extract text-based summary and action phrases |
| `/decide SQLite \| PostgreSQL` | Ask model for a balanced options analysis |
| `/game trivia technology`, `/game trivia general`, `/game wordchain`, `/game guess` | Locally tracked games; `q` quits |
| `/voice status`, `/voice listen 5`, `/voice transcribe /path/clip.wav`, `/voice speak Hello` | Optional, offline speech operations |
| `/continue`, `/reset`, `/exit` | Continue, clear transient dialogue, or exit |

Whisper recording is transcribed locally; the app does not treat automatically transcribed text as an authorized action or automatically persist it.

## Security, privacy and historical commits

`.env`, `config/profile.json`, saved notes and calendar data are ignored by Git. Local JSON files have restrictive POSIX permissions but are **not encrypted at rest**. The public `Echo_Master_Document.md` contains a technical specification, not the owner's populated profile. Any formerly committed private document remains in Git history: **replacing a tracked document in a new commit does not erase it from Git history**. Do not stage raw user tests, chat logs, recordings or private backups.

Run `git status` and inspect `git diff --cached --name-only` before any push. Do not run history rewriting or `git push --force` without deliberately planning recovery for every affected collaborator and clone.

## Tests and acceptance

Run `npm test`, then use [`docs/PHASE1_ACCEPTANCE.md`](docs/PHASE1_ACCEPTANCE.md). Tests use fake-model and fake-clock inputs, so they are not a measure of local model factual accuracy, Whisper/Piper functionality or real reminder delivery. The implementation remains a release candidate until verified against the master-specification exit criteria on the target devices.

## Phase 1 reliability hotfix (v0.1.0-rc.3)

This version routes questions about voice configuration, local runtime timeouts, and device date to deterministic explanations. It recognizes direct binary arithmetic requests and prevents a follow-up such as "just direct answer" from changing subjects. Use `/diagnostics` for the local runtime settings, `/voice setup` for accurate Ubuntu instructions, and `docs/VOICE_SETUP_UBUNTU.md` for optional offline voice installation. Setting `ECHO_OLLAMA_TIMEOUT_MS` changes the Ollama request deadline. It does not increase answer accuracy or context size.


## Optional local voice interactions (Phase 1 candidate)

Ubuntu installation: see [`docs/VOICE_SETUP_UBUNTU.md`](docs/VOICE_SETUP_UBUNTU.md). The setup script is `bash scripts/setup-voice-ubuntu.sh`; review it before running. Local voice tools are not bundled with Echo and need to be installed and hardware-tested separately.

Within Echo, `/voice check` checks the configured files, `/voice speak Hello Echo` tests spoken output, `/voice listen 5` tests speech recognition, `/voice ask 5` sends a recorded question for a text reply, and `/voice chat 5` records a question and speaks the reply. `/voice on` speaks each new answer while the CLI session runs; `/voice off` disables that mode. `answer in voice <question>` requests spoken output for one reply. Echo does not listen continuously, and voice requests that would change saved data require typed confirmation.


## Echo v0.1.0-rc.4 — Voice & inference visibility

This targeted patch adds `/voice test`, audible confirmation when `/voice on` succeeds, visible speech start/end messages, and a short spoken error if a local Ollama request fails while spoken replies are enabled. If a voice activation announcement cannot be played, Echo turns voice mode back off rather than leaving it incorrectly enabled.

The update does not download new models, modify `.env`, change private notes/tasks/calendar/profile data, or alter Git history. It does not guarantee the local language model will answer before timeout, or that ALSA sound will be audible through a particular desktop output device. Follow `docs/VOICE_TROUBLESHOOTING.md` for hardware and model checks.

## Phase 3 candidate — natural tasks and permissioned sync

Echo v0.3.0-rc.1 introduces local natural-language task actions, a typed approval queue for sensitive changes, an action audit and an **optional** manually transferred encrypted note/task snapshot between explicitly trusted devices. It does not send data over a network or run unattended actions.

Examples:

```text
Add networking revision to my tasks
What is on my plate?
I need to study Express.js
/actions
/approve <id>
Mark networking revision done
29+76+19 step by step calculation in binary
/phase3 help
```

Optional device commands include `/device init`, `/device trust <filename.pem>`, `/device peers`, `/sync export <peer-id>`, `/sync preview <filename.echosync>` and `/sync import <filename.echosync>`. Read `docs/PHASE3_PLAN.md` and `docs/PHASE3_ACCEPTANCE.md` before exchanging data. Device private keys and encrypted snapshots are stored in ignored `data/sync/` directories.

Spoken task creation requires an explicit follow-up confirmation to prevent transcription errors from silently modifying saved data. You can use `/voice ask 5` for the request and then again for `confirm` or `cancel`.

Phase 3 is in progress; automatic network sync, autonomous actions, cloud APIs and Android support are not delivered in this release.
