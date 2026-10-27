# Echo — User Manual (v0.3.4-rc.1)

**Scope:** current offline-first command-line candidate. **Audience:** Echo users, including the local owner. **Accuracy rule:** a language-model sentence saying an action happened is not evidence that it happened. Treat confirmations from actual tools and saved files as evidence.

## 1. What is Echo?

Echo is a Node.js command-line personal assistant. It can use a locally running Ollama language model for general conversation and has separate deterministic modules for notes, tasks, calendar, arithmetic, local file creation, reviewed facts, preferences, a learning journal, and project-progress records. It supports optional offline speech input using Whisper.cpp and speech output using Piper. Echo is not an unrestricted autonomous operating-system controller or an online search assistant.

**Implemented and locally testable:** deterministic arithmetic/base conversions; task/notes/calendar; daily progress review; profile plus consent-based learning journal; coding drafts; file draft/preview/approval; manual encrypted note/task-transfer prototype; audio on demand; private context profile; guided interview; category-based memory routing.

**Not implemented:** automatic Google/web research, actual phone calls, live messaging, always-on microphone/wake word, automatic remote sync, unattended autonomous jobs, encrypted local data storage, broad factual verification, training model weights by chatting. The execution sandbox is off by default.

## 2. First launch

```bash
cd ~/Documents/echo
npm install
npm test
npm start
```

At `you>`, type `/help` to see the commands. Type `/exit` to quit. Commands beginning `/` belong **inside Echo** and must not be pasted directly into Bash. Linux terminal commands such as `npm start`, `cp`, `ls` and `git` belong in Bash.

The default chat model is set in `.env` by `ECHO_OLLAMA_MODEL`; an existing local model must be installed in Ollama. Run `ollama list` or `ollama ps` in the Ubuntu terminal to see model availability or whether a model remains loaded.

## 3. Natural communication and exact actions

Examples typed at the Echo prompt:

```text
add networking revision to my tasks
what are my pending tasks?
mark networking revision done
what have I completed?
273 in hexadecimal
29 + 76 + 19 step by step calculation in binary
```

Natural-language patterns are supported only where explicitly routed. A broader sentence may still fall back to Ollama and be misread. If uncertain, use the deterministic `/task` commands. A pending task means a task without a completion marker. The current UI lists completed tasks using `[x]` and incomplete using `[ ]`.

| Inside Echo | Result |
|---|---|
| `/task add Study JS` | Persist a new task |
| `/task list` | List all tasks |
| `/task pending` | List only incomplete tasks |
| `/task completed` | List complete tasks |
| `/task done Study JS` | Complete matching task; ambiguity asks for ID |
| `/notes` | List local notes |
| `/remember Network layers...` | Save a note |
| `/recall layers` | Search saved notes |
| `/event list` | List manually saved calendar items |
| `/event add 2026-11-01T09:00+03:00 \| Revise JS` | Save a local event |
| `/review today` | Local evidence-based daily progress review |
| `/resources` | Inspect local memory availability |

**Calendar caveat:** alerts are checked only while the CLI process runs, not as an operating-system-wide reminder service.

## 4. File creation and verification

Files can only be saved inside `data/code-workspace/`, and draft creation does **not** write them. Examples:

```text
/file create notes.md | I am learning JavaScript.
/file generate hello.js | Print Hello World
/file preview <draft-id>
/file save <draft-id>
/file list
/file read notes.md
```

The generated draft should be inspected before the `/file save` action. No existing file may be overwritten by the current file-write tool. JavaScript syntax is checked where supported; this does not verify runtime behavior, security, accessibility, or logical correctness. The `unit-converter` scaffold is a tested demonstration only; run and inspect it in a browser yourself.

Create Markdown from actual saved incomplete tasks:

```text
create an md file on my pending tasks
/file preview <draft-id>
/file save <draft-id>
/file read pending_tasks.md
```

No fake deadlines, placeholder tasks, or arbitrary filesystem path should be created. In a separate Bash terminal, verify existence with:

```bash
ls -l ~/Documents/echo/data/code-workspace/pending_tasks.md
```

## 5. What Echo remembers

There are deliberately separate local storage modules:

| Module | File under `data/` | Contents | How to update |
|---|---|---|---|
| Notes + tasks | `echo-memory.json` | Explicit notes and task state | `/remember`, `/task`, smart memory |
| Calendar | `echo-calendar.json` | Manually saved events | `/event`, smart memory |
| Private background | `echo-context.json` | Education, progress, projects, preferences, roadmap, confirmed interviews | `/context`, interview, approved project changes |
| Learning journal | `echo-learning.json` | Explicit teaching, corrections and preferences with provenance | `/learn` and approved smart-learning requests |
| Development journal | `echo-devlog.json` | User-reported done/blocker/next | `/devlog` |
| Interview credentials | `echo-interview-key.json` | Salted hash of private combination, **not plaintext** | `/interview setup` |
| Coding workspace | `code-workspace/` | Approved generated or pasted files | `/file` |

All these are excluded from Git by `.gitignore`. **They are not encrypted at rest.** Ubuntu filesystem permissions, encryption of the disk, device access control, and private backups still matter.

## 6. Importing the initial private context

A separate **private seed file** is distributed independently from the public source update. Review its contents before importing. It summarizes education, goals, learning areas, project statuses, preferences and known Echo gaps, based on available user reports. Some statuses may be stale.

In Bash, once you have downloaded both artifacts:

```bash
cd ~/Documents/echo
cp ~/Downloads/Echo_Private_Context_Seed_2026-10-27.json data/echo-context-seed.json
chmod 600 data/echo-context-seed.json
npm start
```

Inside Echo:

```text
/context import preview
/context import confirm
/context summary
/context learning
/context projects
/context preferences
/context roadmap
```

The seed is imported only once and never silently merged with an existing populated context. If the seed changes after preview, import is refused. It is **not copied into** `config/profile.json` or trained into Ollama weights. Private context is retrieved selectively and provided to chat as user-supplied reference data, not as verified external facts.

## 7. Secret combination and guided progress interview

The interview is intended for regular learning/project check-ins. Configure a private combination **on your own Ubuntu terminal**, rather than asking anyone else to choose it. Do not paste it into Echo as an ordinary message, your shell history, project documents, or Git.

At the Echo prompt:

```text
/interview setup
```

The CLI will ask for the combination twice with hidden input. Choose a unique 12–128 character phrase. Then, at each check-in:

```text
/interview unlock
/interview start
```

When asked for a combination, enter it in the hidden prompt. The interview asks about:

1. Current university/academic progress.
2. Programming/backend skills that can be demonstrated independently.
3. Cybersecurity/networking/mathematics/DSA progress.
4. Project statuses (format `Echo: active; CodeBreak: active` for exact status updates).
5. Evidence of completed milestones.
6. Current blockers.
7. Next realistic actions.
8. Changed preferences.
9. Any other corrections or progress.

Answer each question with free text or `/interview answer <text>`. Say `skip` to skip. Before committing anything:

```text
/interview preview
/interview confirm
```

`/interview confirm` is allowed only after all questions are answered or skipped, saves a user-reported dated record and locks the interview again. `/interview cancel` or `/interview lock` discards uncommitted progress. Secret setup and unlock need a physical interactive TTY, not piped text or recorded voice input. The unlock window expires after 30 minutes. Three unsuccessful guesses trigger a five-minute local cooldown.

**Security limit:** this is a local application-level gate, not a replacement for Ubuntu account protection. Anyone with sufficient access to the process, private files, or owner account can potentially bypass app controls. Back up `data/echo-interview-key.json` if you need the same combination after reinstalling; don't store the combination itself in a backup.

## 8. Let Echo choose the appropriate memory module

The reliable supported forms are:

```text
add to memory: task | Revise networking
add to memory: note | IPv6 addresses are 128 bits long
add to memory: completed task | Revise networking
add to memory: correction | Operating systems | Windows supports multiple accounts
add to memory: preference | response_style | Short answers by default
add to memory: project | Echo | active | Testing interview integration
add to memory: event | 2026-11-01T09:00+03:00 | Discrete mathematics study
```

Plain-language variants include `add to memory that I need to study discrete math` (task), `remember that I am learning Express.js` (note) and `add to memory that I prefer brief answers` (preference proposal). An explicit, unclassified memory message is stored as a user note rather than assumed to be a verified fact.

Corrections and preferences create **learning proposals** that must be confirmed with `/learn confirm <id>`. Project updates create proposals confirmed with `/context change confirm <id>`. Only successful write confirmations count as saved. No data is automatically posted, emailed or transferred to another device.

## 9. Voice, model and resource settings

From inside Echo:

```text
/voice check
/voice test
/voice on
/voice off
/voice ask 5
/voice chat 5
```

Whisper.cpp transcribes, Piper speaks, and Ollama generates general conversation. Voice recognition does not prove factual correctness. Speak a single question at a time using the one-shot commands. These are not an always-listening hotword system.

On a CPU-only ThinkPad with about 7 GiB usable RAM, `llama3.2:3b` may slow down with open browsers or memory pressure. Check `free -h`, `ollama ps`, and `ps -eo pid,comm,rss --sort=-rss | head`. Consider benchmarking `llama3.2:1b` for light work. RAM available and inference speed should be measured, not guessed.

## 10. Daily quality workflow

In Ubuntu:

```bash
npm test
npm run evaluate
npm run test:record
```

In Echo:

```text
/review today
/devlog done Completed a test milestone
/devlog blocker The 3B model timed out
/devlog next Verify an interview progress update
```

An automated test result proves only the tested scenario. The curated intent-routing evaluation is **not** a model factual-accuracy score. A user-reported completion is not independently verified. For a bug, preserve the prompt, output, expected output and model/configuration information, but redact private notes and secrets.

## 11. Troubleshooting

- `unzip cannot find`: download the ZIP first and verify `ls -lh ~/Downloads/<filename>.zip` before continuing.
- Unexpected version: `node -p "require('./package.json').version"` in Bash or inspect `npm start` banner.
- `Unknown command`: check `/help`; ensure the correct update actually extracted.
- File not found: drafts are not files. Approve with `/file save <id>` and verify a real path under the workspace.
- Ollama timeout: check `ollama ps`, RAM, service status, prompt length and loaded model. A voice response waits for text generation.
- Learning correction doesn't persist: verify proposal was approved; use `/learn list`.
- Interview locked: run `/interview unlock` and enter the private combination in the masked terminal prompt.
- Private import rejected: context may already be populated, or the seed changed after preview. Do not delete your saved data to force import; back it up and inspect.
- Suspected hallucination: ask for verified tool output; reduce question scope; record the bug for regression testing.

## 12. Release safety

Before committing, run `git diff --cached --name-only` and `git check-ignore` for the private data. Never `git add -f data`. The private seed must be placed only under `data/` on the user's laptop, not under public `docs/`. Inspect generated code and keep the interactive interview combination confidential. Detailed engineering and model-improvement documentation is in the adjacent manuals.
