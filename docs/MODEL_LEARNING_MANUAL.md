# Echo — Training, Personalization and Reliability Manual

**Version:** 0.3.4-rc.1. **Purpose:** teach Echo new personal context without confusing memory with neural-network training, then improve accuracy with repeatable evidence.

## 1. Three different meanings of “training”

### A. Approved local memory (implemented now)

Use `/remember`, smart memory, `/learn teach`, `/learn correct`, `/learn preference`, and the private guided interview. These operations save text locally. On a relevant later question, Echo retrieves a bounded excerpt and supplies it to the local model as reference context. **The model weights do not change.** This is the recommended method for personal learning progress, preferences, changing project status, recent tasks and mistakes.

### B. Retrieval-augmented generation (partially implemented now)

The conversation includes a small selection of saved notes, approved learned facts and relevant private context, with source labels. Future improvements can add a local document library with versioned source metadata, chunking, embeddings, quality filtering and quotation/page references. Prefer verifiable retrieved documents over unsupported model recall for technical lessons. An embedding score is a relevance signal, not proof of truth.

### C. Actual model fine-tuning (NOT implemented)

Fine-tuning changes model parameters using curated examples. Echo has **no command** that does this. A CPU-only ThinkPad with 8 GB RAM is not a practical platform for fine-tuning a modern 3B language model in the normal sense. Future LoRA/QLoRA work would require a supported training environment, lawful usable dataset, permission to use the base model in that way, compatible software, suitable acceleration/memory, held-out evaluations and an explicit opt-in decision. Never imply that chatting or adding a note is online training.

## 2. The first training target: truthful personal context

Load and inspect the private seed with `/context import preview` and `/context import confirm`. Check `/context learning`, `/context projects`, `/context preferences`, and `/context roadmap` carefully. The seed is based on the owner's prior self-reports and can be stale. Update current facts by the secured interview and use `project | ...` memory proposals for individual status changes. Confirm every write. Avoid storing account secrets, health information, precise addresses, access tokens, or copies of entire private documents without a defined use.

When entering an interview, give concrete evidence:

- “I can independently implement a REST GET route and write a test” is better than “I'm good at backend.”
- “Completed chapter 2 of discrete math, solved ten exercises” is more useful than “learned math.”
- “Echo passed 164 automated tests on Ubuntu” records scope; it does not mean general LLM factual accuracy was proven.
- A project status of active, maintenance, planning, on hold or concept should reflect the current user-reviewed state; no guessed completion.

## 3. Training a preference versus teaching a claim

A response-style preference:

```text
/learn preference response_style | Brief answers by default; detailed explanations only when I ask.
/learn confirm <id>
```

A correction:

```text
/learn correct Javascript arrow functions | Parameters must be declared; an arrow function does not infer variable names.
/learn confirm <id>
```

A note from the user:

```text
/remember I plan to revise graph traversal this Friday.
```

These have different semantics. A preference affects style, a correction is user-claimed reference information, and a note is remembered context. A scientific fact should not be treated as verified merely because the owner approved it. If there is a conflict with a deterministic reference fact, Echo should prioritize verified reference data and explain the conflict.

## 4. Building a quality dataset

Maintain a private, structured evaluation collection. Example record:

```json
{
  "id": "math-base-001",
  "prompt": "273 in hexadecimal",
  "expected": "111",
  "category": "number-conversion",
  "requiresTool": "base-conversion",
  "source": "recomputed from exact integer arithmetic",
  "difficulty": "basic",
  "sensitive": false
}
```

For language questions add human-ratable criteria, not one exact response: correctness, relevant context, uncertainty, citations from actual local source docs, no fake actions, tone and verbosity. For coding questions include a syntax check, unit tests, integration tests, and when applicable a security review. For multi-step workflows include state verification in the correct data store and re-run after restart.

**Minimum recommended categories:** (1) task/notes routing, (2) number systems, (3) C/JS programming semantics, (4) OS/networking/security concepts, (5) personal facts and project status with provenance, (6) file writes and safety, (7) voice understanding, (8) unknown or unverifiable questions, (9) prompt-injection resistance, (10) correction/follow-up handling.

A sample “passing accuracy” should never be reported without naming the dataset size, coverage, model version, date, and judge method.

## 5. Known failure cases to include as regression tests

From earlier live Echo logs:

| Prompt | Previously observed mistake | Required verified behavior |
|---|---|---|
| `What are my pending tasks?` | LLM claimed no task knowledge | Query incomplete tasks from local store |
| `273 in hex` | Invented `173`, then `D1` | `111` from exact calculation |
| `29+76+19` | Invalid binary digits and carry | `124₁₀ = 1111100₂` |
| `What does % do in this C program?` | Only explained `%d` | Explain both `rand()%100` remainder and `printf("%d")` formatting as relevant |
| `Teach arrow functions` | Claimed parameters inferred | Declare parameters; explain lexical `this` accurately |
| `Create notes.md` | Claimed file created without filesystem write | Stage, approve, verify on disk |
| `Create MD on pending tasks` | Poor intent match | Draft from actual incomplete task store |
| `Planck's constant is 3×10^8` | Accepted false premise | Distinguish Planck constant from speed of light |
| `Show my progress` | LLM fabricated completion | Show saved interview, devlog and tested milestones with source labels |
| `I prefer short answers` | Ignored remembered preference | Apply approved response-style preference without excessive verbosity |

## 6. Test design: what passes and what remains uncertain

Define independent evaluation groups rather than one blended score. A reasonable release gate for known deterministic actions is **100%** pass on a broad curated suite, because wrong storage operations are not acceptable. For language understanding, establish a representative held-out set; report routing precision/recall and false positive rate. For fact QA, score correctness and calibration separately. For coding, report compile/syntax pass rate, functional test pass rate, and security flaws found. For voice, report transcription word error rate and end-to-end success on actual laptop hardware under realistic ambient noise.

Record latency, memory availability and timeout frequency. On this machine, a 3B model may have better general responses but materially slower CPU inference; compare it with a 1B model using the *same inputs* and conditions.

Do not train/fine-tune on benchmark test questions; keep training, development and held-out evaluation sets separate. Avoid subjective performance claims based on ten handpicked prompts.

## 7. A repeatable improvement loop

1. Capture an observed failure as text with timestamp/version/model and **redacted** context.
2. Specify exactly what Echo should have done and why.
3. Determine whether this is missing deterministic routing, faulty data, retrieval, prompt ambiguity, model reasoning or infrastructure/latency.
4. For exact tasks, implement or repair a deterministic tool; write targeted unit tests and negative tests.
5. For user preferences or life progress, save through approved memory or interview; avoid retraining weights.
6. For factual QA, supply trustworthy local reference documents where licensing and permissions allow; label retrieval source and uncertainty.
7. For multi-step code, validate syntax and run functional tests in a reviewed sandbox; never rely solely on generated text.
8. Run the full test suite and held-out evaluation without changing it mid-run.
9. Compare accuracy, false assertions, latency, memory pressure and stability against previous release.
10. Confirm whether the change improved actual behavior on Ubuntu before committing or tagging.

## 8. Prompt, model and inference tuning

Start with a truthful system prompt describing Echo's implemented abilities and constraints. Keep context relevant instead of injecting entire history. Prioritize compact source provenance over long personal biographies. Prefer lower-variance generation for factual/coding tasks when the Ollama provider supports parameter selection; doing so may improve consistency, but does not guarantee correctness. Benchmark `llama3.2:1b` and `llama3.2:3b` in actual conditions. Update the provider only with tests covering streaming, timeouts, partial responses, and failure recovery. Do not automatically rerun dangerous actions after a model timeout.

Local knowledge needs versioning. For scientific constants or factual corrections, prefer deterministic trusted reference modules; if a reference isn't present, Echo should qualify the answer. Do not hardcode arbitrary user opinions as universal facts.

## 9. Optional future fine-tuning: decision criteria

Do not start fine-tuning until retrieval + verified tools have plateaued and the task type is stable enough to justify model modification. Require: an ethically sourced consented dataset, privacy assessment, clear base-model license, valid train/dev/test split, reproducible training metadata, an appropriately sized accelerator, measurable outcome over a no-fine-tune baseline, rollback plan, and validation against the full safety/factual regression set. Fine-tuning can create new failure modes (catastrophic forgetting, overfitting, false confidence) and does not substitute for a calculator, calendar, or filesystem tool.

If later using a GPU machine, keep private profile/notes out of hosted training by default. Use anonymized task-format examples for behavior, and retrieval-based profile storage for personal facts that change often. Training logs and model checkpoints should be reviewed for data leakage.

## 10. Interview schedule and coaching without fake autonomy

Conduct a voluntary progress review weekly or after a meaningful milestone:

```text
/interview unlock
/interview start
... nine responses ...
/interview preview
/interview confirm
/context interview
```

The current build **does not** run periodic interviews automatically and does not maintain unattended background jobs. You initiate each interview. When you mention a task in an interview, it is recorded as an interview answer—not silently created in your to-do list. Add actual tasks explicitly using smart memory. Use `/review today` for daily logs and local test evidence; use the interview for broader personal growth.

## 11. Model-accuracy safety contract

- Never assert an external action without a verified tool result.
- Never claim web research without a real authorized web connector.
- Never treat a user correction as automatically verified scientific truth.
- Never claim full project completion from a passing unit test suite alone.
- Never treat a printed filename as a file on disk.
- Never store a secret combination as chat, code, or an explicit memory note.
- Never silently publish local personal data or synchronization keys.
- When uncertain, explicitly say what is known, what is user-reported and what remains unverified.

**Success metric:** fewer wrong real-world decisions and false action claims, not simply longer or more confident answers.

## 12. Optional local Ollama prompt customization (not fine-tuning)

If a deterministic, approved response policy is needed across sessions and tested first, create a local Ollama derivative with a `Modelfile` **containing no private context**. In a Bash terminal create a local file with content such as:

```text
FROM llama3.2:1b
PARAMETER temperature 0.2
SYSTEM "You are Echo. Answer concisely. State uncertainty. Do not claim file creation, web access, or actions unless a tool actually confirmed them."
```

Then run `ollama create echo-concise-local -f Modelfile` and point `ECHO_OLLAMA_MODEL` at the new local tag. This only adjusts default generation parameters/system instructions. It **does not** teach new factual knowledge, guarantee mathematical correctness, or change the base model's weights through additional training. Echo's application-controlled tools and prompts remain the primary source of verified capabilities; evaluate your custom model against the same held-out questions before adopting it. Keep any locally personalized or secret-bearing Modelfile out of public Git.

## v0.4 true fine-tuning workflow

Echo now includes `/train add ... | ...` for explicit, owner-reviewed examples, `npm run finetune:prepare` for private train/holdout JSONL, and `training/train_lora.py` for parameter-efficient model **weight** training on compatible CUDA hardware. That script has not been run against the user's hardware or model account. Its adapter output is not automatically compatible with an arbitrary Ollama GGUF file; it must match the exact base model and be evaluated/converted/deployed separately. For commands, data handling, licensing, evaluation and warnings, read `FINE_TUNING_PIPELINE.md`.
