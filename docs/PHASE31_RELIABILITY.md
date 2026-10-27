# Echo v0.3.1-rc.1 — Phase 3.1–3.5 Reliability Candidate

## Release scope

This update targets known live-test regressions from Phase 3.0. It does not imply that Phase 3, real-device voice acceptance, encrypted network sync, or fully autonomous operation are complete. No external provider, cloud service, or GPU is required for the newly deterministic functions.

### 3.1 Natural-language intent and task state

- `echo what are my pending tasks`, `what is left`, `what is on my plate` and `/task pending` read **incomplete** saved tasks only.
- `what have I completed`, `/task completed`, and `did I complete MongoDB?` read actual saved completion state.
- `/task status <name or ID>` checks task state without mutating it. Ambiguous descriptions yield candidates instead of guessing.
- `I will study Discrete Math` proposes a task for approval when Phase 3 approval controls are enabled; it does not silently save a plan.
- Explicit commands such as `/task add` are unchanged.

### 3.2 Verified mathematics and code

- Decimal, binary, octal, and hexadecimal conversions use BigInt and validate their input digits. Example: `273 in hex` → `111` (base 16).
- `273 in hex step by step` includes division and verification steps.
- Existing binary addition with multiple operands remains deterministic.
- `/code syntax example.js` reads only the private code workspace and performs a Node.js **syntax-only** check; it does not run user code, test its behavior, or guarantee security.
- A focused C `%` explanation distinguishes `rand() % 100` (remainder) from `printf("%d", n)` (formatting). Verified JavaScript arrow-function syntax guidance is available for basic lessons.

### 3.3 Conversation reference and uncertainty

- On referential follow-ups, Echo can pass a bounded excerpt of its preceding generated response to the model as **unverified reference text**. It does not claim that old generated text is factual evidence.
- Exact saved task state and number conversions bypass the model, so they don't depend on its short-term recall.
- Arbitrary programming, science, and open-ended factual responses are **not independently verified**. A 3B local LLM can still be wrong.

### 3.4 Truthful tool outcomes

- Task completion/status, note saves, and base conversions report results only after the actual local operation.
- `/accuracy` explains the limits of deterministic tools and generative answers.
- `/code syntax` distinguishes successful parsing from correctness or safe execution.
- Existing approval checks for deletions and device trust remain in force; network transfer and autonomous actions remain disabled.

### 3.5 Daily review and quality measurement

- `/review today`, `/review`, or `what did we accomplish today?` shows tasks marked complete **today**, incomplete tasks, explicitly user-reported development progress/blockers/plans, and local action-audit counts. It never invents GitHub commits, test results, or external accomplishments.
- `/devlog done <text>`, `/devlog blocker <text>`, `/devlog next <text>` explicitly record user-reported information. `/devlog list` lists it.
- `npm run test:record` executes automated tests and records an evidence summary privately to `data/echo-test-report.json`.
- `npm run evaluate` measures matching performance against 43 **curated routing examples**, writes `data/echo-quality.json`, and fails if any routing case is wrong. It is not a measure of general language-model accuracy.
- The review log is stored in `data/echo-devlog.json` with restricted local file permissions. The three new `data/` files remain Git-ignored; they are not encrypted at rest.

## Examples inside Echo

```text
Echo, what are my pending tasks?
What have I completed?
Did I complete MongoDB?
What is on my plate?
I will study Discrete Math
273 in hex
111 from hex to decimal
273 in hex step by step
Teach me arrow functions
What does % do in the C program?
/review today
/devlog done Tested the phase 3.1 task router
/devlog blocker My model occasionally times out
/devlog next Validate voice recognition
/accuracy
/code syntax demo.js
```

## Install

From the actual Echo repository on Ubuntu, back up local private files before extracting the update ZIP. It does **not** contain `.env`, `config/profile.json`, `data/`, `.git`, or `Echo_Master_Document.md`.

```bash
cd ~/Documents/echo
git status
unzip -o ~/Downloads/Echo_v0.3.1-rc1_phase31-35_reliability_update.zip -d .
npm install
npm test
npm run evaluate
npm run test:record
npm start
```

`npm run test:record` intentionally reruns the suite and stores a timestamped summary. Run `/review today` afterward to see the recorded test counts. For systems with memory pressure, close heavy applications and check `free -h`; the new deterministic features don't require Ollama to load additional models.

## Acceptance checklist

- [ ] Automated tests pass on the target Ubuntu Node 24 installation.
- [ ] The 43 curated routing cases pass.
- [ ] `echo what are my pending tasks` excludes completed tasks, and `/task completed` shows them.
- [ ] `did I complete MongoDB?` reflects the actual saved status or reports ambiguity.
- [ ] `273 in hex` returns `111` and reverse conversion returns 273.
- [ ] C `%` explanation correctly distinguishes remainder from formatting.
- [ ] `/code syntax demo.js` checks syntax but does not execute code.
- [ ] `/devlog` survives an Echo restart; `/review today` includes provenance labels.
- [ ] `/review today` reports only recorded tests and activity, not fabricated accomplishments.
- [ ] Verify real Ollama and voice behaviors separately; simulated tests do not establish actual model accuracy or sound input/output.

## Current limitations

Natural-language matching is intentionally conservative. It covers common validated expressions, not the open-ended understanding of a much larger assistant. The test corpus measures only those 43 cases. Model responses are not guaranteed accurate, and no browser/web retrieval was added. Historical privacy content in old Git commits is not erased by this update. Phase 1 voice acceptance and Phase 3 device-to-device testing remain open.
