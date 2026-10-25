# Echo — Local-first Personal AI Agent

**Version:** v0.0.3 · **Current phase:** Phase 0 — Foundation · **Milestones:** 0.1–0.3 verified by the developer; 0.4–0.5 implemented, live Ubuntu verification pending.

Echo is a modular, local-first personal AI assistant. Derrick is the human creator; **Echo is the AI**, not Derrick. The long-term project roadmap encompasses offline conversation, routine management, coding support, approved autonomy, Android/Windows/Ubuntu continuity and telephony. **Those later-phase capabilities have not been implemented.**

## What's working in v0.0.3

- Local chat through Ollama (`llama3.2:1b`) and token-by-token terminal output.
- Private profile loaded from `config/profile.json` (not committed to Git).
- Explicit, **persistent** personal notes (`/remember`, `/notes`, `/forget`).
- Keyword note search and optional **vector search** with `all-minilm` (`/recall`, `/index`).
- Persistent tasks (`/task add`, `/task list`, `/task done`).
- **On-demand routine snapshot** (`/routine` or `/today`) from saved tasks and profile goals.
- Automated tests for persistence, retrieval, identity instructions, streaming, and error handling.

**Important limitations:** Everyday conversation is **not** automatically converted into permanent memory. Saving a note does **not** train or fine-tune the model. Task entries do **not** schedule alarms. Routine summaries do not read your calendar. The model may still make reasoning mistakes, especially with a 1B CPU-only model. Stored data is local plaintext with restrictive file permissions, **not encryption at rest**; encryption remains future security work.

## Requirements

- Ubuntu, Node.js 24, npm, Git.
- Ollama installed with service running (`systemctl status ollama`).
- Chat model: `ollama pull llama3.2:1b`.
- For semantic note retrieval: `ollama pull all-minilm` (lightweight ~46 MB embedding model). Source: https://ollama.com/library/all-minilm

## Upgrade an existing Echo v0.0.2 repository

**Do not replace the repository directory, `.git`, `.env`, or `config/profile.json`.** The upgrade ZIP contains only changed public files, not personal data.

```bash
cd ~/Documents/echo
unzip -o ~/Downloads/echo-milestones-0.4-0.5-update.zip -d .
npm install
ollama pull all-minilm
```

Your existing `.env` will **not** be overwritten. To use recommended CPU-limited settings, edit it and set:

```dotenv
ECHO_MODEL_PROVIDER=ollama
ECHO_OLLAMA_URL=http://127.0.0.1:11434
ECHO_OLLAMA_MODEL=llama3.2:1b
ECHO_EMBED_MODEL=all-minilm
ECHO_MAX_TURNS=4
ECHO_MAX_OUTPUT_TOKENS=192
ECHO_CONTEXT_TOKENS=2048
```

```bash
npm test
npm start
```

`data/echo-memory.json` will be created when you first save a note or task. It is ignored by Git. This project stores memory in a versioned JSON file for Phase 0; production-scale database and encrypted storage are later considerations. Copy a backup of your private `data/` folder before upgrades once it contains valuable information.

## CLI commands

| Command | Effect |
| --- | --- |
| `/help` | Show all commands |
| `/status` | Display project phase statuses |
| `/model` | Display chat and embedding models |
| `/profile` | Confirm whether private profile was loaded |
| `/identity` or `whoami` | Deterministically distinguish Derrick (human) and Echo (AI) |
| `/remember <note>` | **Save** a note to disk; try local vector indexing |
| `/notes` | List saved notes and their short IDs |
| `/recall <query>` | Find notes; uses vectors when available, keyword fallback otherwise |
| `/index` | Retry embedding notes not yet vector-indexed |
| `/forget <note-id>` | Permanently remove a saved note |
| `/task add <description>` | Save a task (does not schedule an alarm) |
| `/task list` | List saved tasks with IDs |
| `/task done <task-id>` | Mark one saved task completed |
| `/routine` or `/today` | Show an on-demand routine snapshot using saved tasks/profile |
| `/reset` | Clear current chat history; saved notes and tasks remain |
| `/exit`, `/bye`, or `exit` | Exit Echo |

### Verify note persistence and search

```text
$ npm start
you> /identity
Derrick is the human owner and creator of Echo. Echo is the AI assistant, not the human.
you> /remember I'm learning Express.js routes.
echo> Saved note [xxxxxxxx]. Semantic vector indexed.
you> /recall backend web framework
Memory search (semantic + keyword):
[xxxxxxxx] I'm learning Express.js routes.
you> /task add Study Express.js for 30 minutes
echo> Added task [yyyyyyyy]: Study Express.js for 30 minutes
you> /routine
Routine snapshot — ...
you> /reset
you> /notes
[xxxxxxxx] I'm learning Express.js routes.
you> /exit
```

Re-run `npm start` and `/notes` to confirm persistence. The IDs and output are illustrative; live retrieval quality depends on the actual embedding model and query.

## Architecture

```text
src/echo.js                   Bootstrap; reads config, wires dependencies
src/phases/phase-00.js        Phase-0 composition and help
src/core/conversation.js      Recent conversation history + note context
src/core/routine.js           Deterministic on-demand routine summaries
src/memory/profile.js         Private human profile and identity prompt
src/memory/store.js           Persistent notes/tasks, ranking, file storage
src/providers/ollama.js       Local streaming/non-streaming chat API
src/providers/embeddings.js   Local semantic embedding API
src/interfaces/cli.js         Commands and terminal output
```

The remaining `src/phases/phase-01.js` through `phase-05.js` remain placeholders. Details are in `docs/ARCHITECTURE.md` and `docs/phases/phase-00.md`.

## Privacy and safety

- Phase 0 enforces an Ollama loopback address and rejects explicitly named `:cloud` models. It does not inspect the entire Ollama model manifest or enforce offline networking at the OS level; only select locally downloaded models.
- **Never commit** `.env`, `config/profile.json`, or any files from `data/`.
- Saved notes and tasks are personal reference data, **not trusted instructions**. Do not store passwords or credentials in Phase 0 plaintext memory.
- Stored memory files use atomic replacement and private Unix permissions, but are **not encrypted at rest**.
- Notes are saved/forgotten only through explicit commands. No arbitrary filesystem/system-execution tool is enabled.
- `.env.example` is public; `.env` remains personal and excluded from Git.

## Phase 0 acceptance checklist

- [x] Development environment, repository and Ollama service (developer confirmed).
- [x] Milestones 0.2/0.3 Ollama chat and private profile (developer terminal test).
- [x] Milestone 0.4 code + automated tests (persistent notes and retrieval).
- [x] Milestone 0.5 code + automated tests (on-demand routine summary).
- [ ] Live Ubuntu smoke test: restart and confirm persistence, vector retrieval, routine output, offline use, and resource consumption.

Phase 0 is **not yet marked complete** until the acceptance checks pass on the actual machine.

## Git workflow

```bash
git status
git check-ignore .env config/profile.json data/echo-memory.json
git add README.md .env.example package.json package-lock.json src docs tests
git commit -m "feat: add persistent memory, semantic recall and routine summary"
git push
```

**License:** Not selected. No license is granted automatically by making a public repository.
