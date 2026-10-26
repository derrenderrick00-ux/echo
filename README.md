# Echo — Local-First Personal AI Agent

**Release:** v0.0.4 (Phase 0 reliability candidate)  
**Status:** Phase 0 is feature-complete against its basic scope, but acceptance on the developer's Ubuntu machine is pending. Phase 1 is **planned**, not yet implemented.

Echo is an offline-first personal AI assistant developed by Derrick. **Derrick is the human creator; Echo is the AI assistant.** The master specification is the source of truth for planned phases; never confuse future features with implemented capabilities.

## What works now

- Local conversations through Ollama with streamed text output and a private startup profile.
- Explicit notes saved to local disk, recalled by keyword or local vector embeddings (`all-minilm`).
- Local tasks with persistent completion state, referenced by task ID **or unique task description**.
- On-demand factual routine snapshot from manually saved tasks and profile goals; **not a calendar, notification, or alarm**.
- Deterministic basic arithmetic and decimal-to-binary conversion (not guessed by the LLM).
- Explicitly phrased natural-language requests such as `Remember that ...`, `... add that to memory`, or `I have completed ...`, with confirmation. No automatic saving of ordinary chat.
- Helpful `/abilities` and `/identity` outputs. Robust queued CLI input even when stdin is piped.

**Not implemented:** real alarms, calendar sync, voice commands, mobile clients, internet browsing, system control, autonomous actions, game-state tracking or phone calls. Local notes are plaintext protected by OS file permissions, **not encrypted at rest**. Never store passwords here.

## Requirements

- Ubuntu and Node.js 24 (`node --version`), npm, Git.
- Locally running Ollama (`systemctl status ollama`).
- Chat model: `ollama pull llama3.2:1b` (existing baseline).
- Optional stronger chat model: `ollama pull llama3.2:3b` (evaluate on 8 GB CPU-only laptop first).
- Embedding model: `ollama pull all-minilm`.

## Upgrade from v0.0.3

Do **not** replace your entire repository or delete `.git`, `.env`, `config/profile.json`, or `data/echo-memory.json`.

```bash
cd ~/Documents/echo
git status
# Back up your local memory outside the repository if you value these notes:
mkdir -p ~/Documents/echo-private-backups
cp -a data ~/Documents/echo-private-backups/data-before-v004
# Assuming downloaded update ZIP is in ~/Downloads:
unzip -o ~/Downloads/echo-v0.0.4-phase0-closeout-update.zip -d .
npm install
npm test
npm start
```

The patch ZIP contains **only public project files**. Existing `.env` and private profile remain unchanged.

### Local model upgrade (optional)

```bash
ollama pull llama3.2:3b
npm run benchmark -- llama3.2:1b llama3.2:3b
```

Use the results to choose between speed and accuracy. To select 3B, edit your private `.env`:

```dotenv
ECHO_MODEL_PROVIDER=ollama
ECHO_OLLAMA_URL=http://127.0.0.1:11434
ECHO_OLLAMA_MODEL=llama3.2:3b
ECHO_EMBED_MODEL=all-minilm
ECHO_MAX_TURNS=4
ECHO_MAX_OUTPUT_TOKENS=256
ECHO_CONTEXT_TOKENS=2048
```

**Note:** Config is read on startup; exit Echo and run `npm start` after changes. Your ThinkPad has 8 GB RAM and CPU-only inference; 3B may be slower or compete with browser/VS Code for memory. Model upgrade is **not guaranteed** to fix every error. Keep 1B as a fallback by changing just `ECHO_OLLAMA_MODEL`.

### Commands

| Command | What it does |
| --- | --- |
| `/help` | Available commands |
| `/identity` or `whoami` | Distinguish creator and assistant |
| `/abilities` | Implemented vs planned functionality |
| `/model` / `/profile` / `/status` | Diagnostics |
| `/remember <text>` | Save one explicit note |
| `/notes` | List saved notes |
| `/recall <query>` | Keyword + semantic note search |
| `/forget <id>` | Delete a saved note |
| `/index` | Rebuild missing note embeddings |
| `/task add <description>` | Add a manual task |
| `/task list` | Show tasks and IDs |
| `/task done <id or unique description>` | Complete one unambiguous task |
| `/routine` / `/today` | Snapshot of profile goals and manual tasks |
| `/reset` | Clear session chat (not saved notes or tasks) |
| `/exit` / `exit` | Close application |

Explicit natural-language requests also work for certain commands:

```text
you> Remember that I am learning Express.js.
echo> Saved note [...]. Semantic vector indexed.
you> /task add Complete networking revesion
echo> Added task [...]: Complete networking revesion
you> I have completed networking revision
echo> Completed task [...]: Complete networking revesion
you> 980 convert to binary
echo> 980 in binary is 1111010100.
you> What can you do?
Echo v0.0.4 — implemented now: ...
```

Unclear memory references (`add that to memory` without text) require you to provide the exact note. Unclear task matches list IDs rather than guessing.

## File structure

```text
src/echo.js                   Application bootstrap
src/phases/phase-00.js        Phase 0 composition and status
src/phases/phase-01.js        Future Phase 1 placeholder
src/core/conversation.js      Conversation context assembly
src/core/config.js            Local model configuration validation
src/core/intent.js            Limited natural-language intent router
src/core/math.js              Deterministic arithmetic and base conversion
src/core/capabilities.js      Grounded list of implemented features
src/core/routine.js           Factual on-demand routine snapshot
src/interfaces/cli.js         CLI input queue, commands and output
src/memory/profile.js         Private profile and identity prompt
src/memory/store.js           Private persistent notes and tasks
src/providers/ollama.js       Local AI chat API
src/providers/embeddings.js   Local note embeddings API
scripts/benchmark-models.js   Offline small-model comparison
config/profile.example.json  Public example only
config/profile.json          YOUR private profile — ignored by Git
data/echo-memory.json        YOUR private notes — ignored by Git
```

## Testing and acceptance

```bash
npm test
```

Run the manual checks in [`docs/PHASE0_CLOSEOUT.md`](docs/PHASE0_CLOSEOUT.md) to decide whether Phase 0 can be marked complete. Check note persistence after exit/restart, task completion by description, exact binary conversion, private profile, offline model inference, and an on-demand `/routine` response. When passing, start the work listed in [`docs/phases/phase-01.md`](docs/phases/phase-01.md).

## Security and Git

- `.env`, `config/profile.json`, and `data/echo-memory.json` should be ignored by `.gitignore`.
- Never add API keys, private user data, or the local memory file to GitHub.
- Phase 0 itself only contacts loopback Ollama. Use local model tags; do not select cloud model aliases.
- `data/echo-memory.json` uses restrictive Unix permissions and atomic writes, but no encryption at rest.
- Natural-language requests may cause a local save **only when they explicitly request memory storage or task creation/completion**. Each such action is acknowledged.

**License:** Not selected. GitHub visibility alone does not grant a license for redistribution.
