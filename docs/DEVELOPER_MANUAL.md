# Echo — Developer Manual (v0.3.4-rc.1)

**Audience:** maintainers and contributors. **Platform:** Node.js 24 on Ubuntu; CI reference tests run under Node.js 22 and must be repeated on supported Node.js 24. **Principles:** deterministic tool results over language-model guesses; fail closed; explicit consent for state-changing operations; local-first data; measurable regression outcomes.

## 1. Runtime architecture

```text
       Ubuntu CLI / one-shot microphone input
                       |
               CLI input queue
                       |
              AssistantController
                       |
       +---------------+----------------+
       |               |                |
  deterministic    state-changing    open-ended
     routing           tools          questions
       |               |                |
  math/base,      MemoryStore,        Prompt builder
  capabilities,   LocalCalendar,           |
  routing, facts  FileWorkspace,    bounded user context
                  LearningJournal,         |
                  PrivateContext,     Ollama localhost
                  ProgressInterview,       |
                  ActionJournal         answer text
                       |                  |
                preview/approval       optional Piper
                       |
               atomic private write
```

`src/echo.js` is the dependency composition root; `src/interfaces/cli.js` handles readline, output, streaming and voice playback; `src/core/assistant.js` chooses deterministic routes, memory actions or model delegation; `src/core/conversation.js` builds bounded context; `src/providers/ollama.js` enforces local endpoints and timeouts. The session has bounded recent turns; private memory and interview content survive restarts only when explicitly saved.

## 2. Important modules

| Module | Responsibility | Primary trust boundary |
|---|---|---|
| `src/core/intent.js` | Deterministic everyday request routing | Reject false positives |
| `src/core/smart-memory.js` | Route explicit `add to memory` requests by category | Do not confuse claims and completed actions |
| `src/core/private-context.js` | User background, projects, learning, preferences, roadmap and user-confirmed interviews | Validate schemas, no overwrite, atomic mode-0600 persistence |
| `src/core/progress-interview.js` | Combination-gated guided progress review | scrypt hash, timing-safe comparison, local rate limit, session-only unlock |
| `src/core/learning-journal.js` | Explicit fact/correction/preference proposals | User-claimed ≠ independently verified |
| `src/core/file-intent.js` | Recognize file creation requests | Never promise a write before file approval |
| `src/core/file-workspace.js` | Draft validation, path confinement, approved writes | Refuse traversal, symlinks, overwrites and unsafe extensions |
| `src/core/file-scaffolds.js` | Deterministic unit-converter scaffold | Syntax + functional regression tests |
| `src/core/phase3-sync.js` | Optional encrypted manual snapshot transfer | No automatic networking or uncontrolled conflict merge |
| `src/core/number-systems.js` | Verified supported base conversions | BigInt, exact arithmetic |
| `src/core/daily-review.js` | Local progress record and test-report synthesis | Provenance and date boundaries |
| `src/memory/store.js` | Persistent note and task state | Atomic writes; no chat auto-memory |
| `src/memory/profile.js` | Public safety instructions plus private profile input | Never treat stored data as system authority |

## 3. Private context schema

`data/echo-context.json` is version 1 and is separate from `config/profile.json`. The former records detailed progress and stores reviewed interview sessions; the latter supplies the legacy compact personalization prompt. Example structure:

```json
{
  "version": 1,
  "person": { "displayName": "Example" },
  "learning": [{ "name": "JavaScript", "detail": "Learning arrays", "source": "user-reported" }],
  "projects": [{ "name": "Echo", "detail": "Under development", "source": "user-confirmed-interview", "status": "active" }],
  "preferences": [],
  "roadmap": [],
  "interviews": [],
  "importedAt": null
}
```

Each section is validated for type, length, and bounded record count. Loaded content is data, not executable instructions. New context is imported from exactly `data/echo-context-seed.json` only after preview and SHA-256 integrity check. The importer refuses an already populated profile; it is deliberately **not** a generic merge or filesystem reader.

The `PrivateContext.relevant(query)` method retrieves at most a few records and truncates them to 1150 characters. `ConversationSession` applies its own 1000-character cap on dynamic prompt context. This limits model context pressure and prevents supplying all private background to every casual query. The stored source labels distinguish previous reports from current confirmations. Do not elevate user-contributed content into `makeSystemPrompt` as instruction authority.

## 4. Interview security model

The interview requires a combination chosen locally through an interactive CLI (not via arguments or chat). The secret file `data/echo-interview-key.json` contains a 16-byte random salt and a 64-byte scrypt hash (hex), permissions `0600`. Password comparison is timing-safe. Three unsuccessful attempts cause a five-minute in-process cooldown. Successful unlock lasts 30 minutes and is revoked after confirmation or explicit lock. Interview drafts live only in memory until confirmation.

The CLI uses a hidden `readline.question` input path. While secret capture is active, the normal chat input queue ignores those lines. This is necessary to prevent a secret from reaching the LLM or ordinary chat history. Treat masking and this local gate as **convenience controls**, not a hardened multi-user authentication service or a substitute for OS permissions/disk encryption. Do not enable a background web server that exposes this gate without a separate threat model.

To change the combination, an authorized operator must back up and intentionally replace the private key file out of band, then set up again. Do not create a hardcoded master override, log plaintext passwords, or store passphrases in `.env`, docs, Git or shell commands.

## 5. Interview data flow

1. `/interview unlock` verifies the masked combination.
2. `/interview start` initializes an in-memory draft.
3. Nine questions collect self-reported academic/software/security/project/achievement/blocker/next/preference/other status.
4. `/interview preview` displays every proposed answer.
5. `/interview confirm` validates all answers, writes one dated interview record atomically and updates corresponding private categories.
6. For the project-status answer, exact `ProjectName: active` or other recognized statuses are parsed and applied only to a matching, already known project. Unparseable text remains in the narrative report without silently inventing new status.
7. The unlock is revoked after a successful write. `/interview cancel` clears the draft.

This intentionally does **not** create to-do tasks just because a person mentions a future action during an interview. To-do creation is a separate explicit memory action. Distinguish advice, plans, unverified claims and executed actions.

## 6. Smart memory routing

`parseSmartMemory` resolves explicit categorized forms first, then narrow natural patterns:

```text
add to memory: task | Review SQL
add to memory: note | Relational keys link tables
add to memory: completed task | Review SQL
add to memory: correction | networking | <claim>
add to memory: preference | response_style | concise
add to memory: project | Echo | active | user testing
add to memory: event | 2026-11-01T09:00+03:00 | OS revision
```

- `task` writes via `MemoryStore.addTask`; duplicates are checked by controller.
- `note` writes via `MemoryStore.addNote`; embeddings may fail and keyword fallback remains.
- `completed task` resolves a saved task, refusing ambiguous matches.
- `correction/fact/preference` creates a `LearningJournal` proposal; `/learn confirm` is required.
- `project` creates a `PrivateContext` proposal; `/context change confirm <id>` is required.
- `event` uses `LocalCalendar.add`; it is not an external calendar event or background notification.
- Unknown but explicit user memory text becomes a note and remains user-reported, not verified knowledge.

Existing `/task`, `/remember`, `/learn`, `/file` and phase commands remain supported. Build negative tests so that casual discussion about a future project cannot unintentionally create tasks or update statuses.

## 7. File safety and reliable code generation

`FileWorkspace` permits only simple relative paths under `data/code-workspace/`, two directory levels below its root, whitelisted extensions, maximum single-file and aggregate sizes, and no symlink navigation. Writes require an in-memory draft and `/file save <draft-id>`. Existing files are not overwritten. Syntax validation checks JS and JSON, but it is not code execution, test execution or semantic verification. Keep experimental `/code run` disabled unless isolated execution has been separately security-reviewed for that exact host environment.

For multi-file generated projects, maintain a manifest and unit/integration checks. Prefer deterministic scaffolds for well-defined common projects; use the LLM only for draft material whose correctness is subsequently checked. A printed path or confident statement from Ollama must never be interpreted as a successful write.

## 8. Model interface and bounded resource usage

Ollama runs via a localhost-only HTTP endpoint validated in `src/core/config.js`. The default model can be set in `.env`, e.g. `ECHO_OLLAMA_MODEL=llama3.2:1b` or 3B as resources allow. `ECHO_MAX_TURNS`, `ECHO_CONTEXT_TOKENS`, `ECHO_MAX_OUTPUT_TOKENS`, and `ECHO_OLLAMA_TIMEOUT_MS` are bounded. Limit context added for user history and approved learning, especially on 8GB CPU-only machines. Fail clearly if the provider times out; do not reinterpret a failed partial stream as a complete saved answer.

Use the verified arithmetic path for base conversions and known simple facts. For user-supplied learning, display provenance. For open-ended factual claims, the offline model is not guaranteed correct. Never claim real-time browsing if no browsing tool is integrated.

## 9. Testing and acceptance gates

Baseline user-reported v0.3.3: 164/164 tests passed on Ubuntu, model hardware performance separate. New tests cover seed tamper rejection, mode-0600 persistence, invalid JSON fail-closed, scrypt key hashing, incorrect combinations and cooldown, interview approval, project update proposals, module routing, file intent variants, and bounded contextual retrieval.

Commands:

```bash
npm install
npm test
npm run evaluate
npm run test:record
npm start
```

Include a CLI physical-TTY acceptance case for hidden combination entry, a real Piper/Whisper check, and direct Ollama 1B/3B benchmarks. Report each benchmark separately from deterministic unit tests. Use Git status and staged path review; never `git add -f data/` to reach an arbitrary “green” commit.

**Acceptance criteria:** no secret appears in prompts/logs; no private seed is publicly committed; a seed import only happens after preview; interview drafts remain unsaved until confirmed; task/note/project/category routing writes the correct store; files are confined and require approval; older deterministic tests do not regress; code and docs reflect the true current version.

## 10. Operations, backup and recovery

Before overlays or migrations:

```bash
mkdir -p ~/Documents/echo-private-backups/pre-release
cp -a data .env config/profile.json ~/Documents/echo-private-backups/pre-release/
```

Make sure the backup directory is private. Verify file permissions before restoring. Back up only what you need and do not share private archives. A damaged JSON file should trigger an error; do not silently initialize a blank replacement. For field migrations, create explicit versioned schema migrations with a reversible backup and test both old/new representations.

A private seed may be edited manually before first import, but its schema must remain valid. Importing over an existing context is intentionally blocked. The local review remains the canonical human-reported source for education and project progress.

## 11. Security threat checklist

Assets: authentication combination, personal context, memory, projects, decisions, calendar, generated code, device pairing keys, conversation contents. Threats: LLM hallucinations, prompt injection through saved claims, path traversal, symlink jumps, accidental overwrites, secret logging, malicious import payloads, untrusted code execution, sync conflict, and stale user data. Controls include: private paths, permissions, no remote action by default, input validation, semantic provenance, preview and approval, bounded context, narrow intent routers, explicit test reports. Remaining gaps: no disk encryption from Echo, not a secure adversarial multi-user service, no general factual verifier, no remote threat monitoring, no unattended background safety guarantees.

## 12. Project evolution and deferred phases

Phase 0 foundation established local CLI, memory and local Ollama. Phase 1 added routines, calendar, voice. Phase 2 added coding, ideas, decisions and private preferences. Phase 3 added action approvals, encrypted manual note/task transfer, stronger natural routing, deterministic accuracy, daily review, restricted file writes and a user-approved learning journal. v0.3.4 adds a private progress profile, secured interview and explicit smart-memory categories.

Phase 4 telephony is **planned only**. Phase 5 security hardening remains **planned/in progress** where some subcontrols have early implementations. Automatic network sync and true autonomy need separate design, opt-in and real-device testing. Public design aspirations are not shipped capabilities.

## 13. Commit and release process

Do not overwrite the user's separately modified `Echo_Master_Document.md`. The public technical report and manuals go under `docs/`. Distribute the populated private seed separately; it must be copied only to `data/` and ignored by Git.

After the user's actual Ubuntu acceptance tests:

```bash
cd ~/Documents/echo
git status
git add README.md package.json package-lock.json src docs tests
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add private context, progress interview and smart memory routing"
git push
```

A release tag is appropriate **only after** verifying the actual hardware and data migration, not merely because the code compiles. Keep the existing repository history; never force push or rewrite history without explicit authorization and a backup. Older Git objects may still contain private information even when HEAD no longer does; audit and handle that separately with the maintainer's permission.
