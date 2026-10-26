# Echo — Architecture Baseline (v0.0.3)

**Authority:** Echo Master Document, Part 1, specification v1.3. Phase 0 foundation.

## Data flow

```text
 Human user (Derrick)
         |
         v
     CLI (src/interfaces/cli.js)
         |
         v
     src/echo.js  -> Phase-00 integration
         |                |
         |                +-> Personal profile (private config/profile.json)
         |                +-> Persistent MemoryStore (data/echo-memory.json)
         |                |         |                  |
         |                |      Notes/tasks       Vectors (all-minilm)
         |                +-> Conversation Session -> Ollama Chat Provider -> llama3.2:1b
         |                +-> Routine snapshot from open tasks and profile
         v
      User sees response
```

## Responsibilities

- `src/echo.js`: dependency wiring only.
- `src/phases/phase-00.js`: initialize the initial capability bundle; later phases reuse components.
- `src/interfaces/cli.js`: parse explicit commands and render streaming tokens.
- `src/core/config.js`: validate local-only model endpoint and model settings.
- `src/core/conversation.js`: assemble identity/personality prompt, short-term dialogue and optionally relevant stored notes.
- `src/memory/profile.js`: load private structured profile and enforce clear Derrick/Echo roles in the system instruction.
- `src/memory/store.js`: versioned JSON data store of explicit notes, embeddings and tasks; atomic writes + `0600` file and `0700` folder permissions.
- `src/providers/ollama.js`: chat via local Ollama `/api/chat`, optionally with NDJSON streaming for perceived speed.
- `src/providers/embeddings.js`: embed notes and `/recall` queries via local Ollama `/api/embed`; fallback keyword retrieval if embed model not present.
- `src/core/routine.js`: deterministic snapshot of open tasks + profile focus; **not** an actual calendar integration or timed scheduler.

## Storage contract (v1)

```json
{
  "version": 1,
  "notes": [
    { "id": "short-id", "text": "user-entered note", "createdAt": "ISO-8601", "vector": { "model": "all-minilm", "values": [0.1] } }
  ],
  "tasks": [
    { "id": "short-id", "text": "user-entered task", "done": false, "createdAt": "ISO-8601" }
  ]
}
```

The vector is optional. The store supports up to 500 notes and 300 tasks in Phase 0. Retrieval is a linear vector scan, which is suitable for this small personal dataset; a dedicated vector database can be introduced later. Explicit user commands control durable writes. Ordinary conversation is **not** auto-saved.

## Latency and accuracy

- 8 GB CPU-only system: prefer `llama3.2:1b`, 4 recent turns, 2048-token context and 192-token replies (configurable).
- Stream response tokens as generated; streaming improves **perceived** latency, not model compute speed.
- Semantic `/recall` runs an extra embedding model, which incurs CPU cost. Ordinary chat uses cheap lexical matches, not an embedding call on every turn.
- Identity commands are deterministic. The system prompt also distinguishes human/AI identity, but a 1B language model can still misinterpret requests.

## Phase boundaries

- Phase 0: local chat, structured profile, basic semantic memory, on-demand routine summary.
- Phase 1: robust dialog, offline voice, scheduled routine & calendar.
- Phase 2: safe sandboxed coding and decision journal.
- Phase 3: permissions, background autonomy, E2E multi-device sync.
- Phase 4: supported telephony adapters and explicit consent.
- Phase 5: security, observability, battery/performance hardening.

## Security boundaries and known gaps

- Phase 0 stores local plaintext data with restrictive permissions. Encryption at rest is **not implemented**.
- Echo itself calls loopback Ollama; Ollama service settings and model selection must be separately configured for strictly offline use.
- Retrieved notes are treated as reference material, not executable instructions, but the LLM may still be susceptible to prompt injection; do not store untrusted content as highly privileged instructions.
- No external-action tools or scheduling engine are enabled in Phase 0.
- Personal profile and runtime memory must never enter Git; `.gitignore` excludes them.

## v0.0.4 Phase 0 reliability changes

- `src/core/intent.js` recognizes a deliberately limited set of **explicit** local instructions; it does not automatically turn general chat into permanent memory. Missing or ambiguous references are not silently persisted.
- `src/core/math.js` evaluates bounded arithmetic and decimal-to-binary conversion directly rather than making the 1B/3B model guess. The router delegates other math and general questions to the model.
- `src/core/capabilities.js` is a deterministic, versioned capabilities summary to prevent confusion between current and planned features.
- `src/memory/store.js` can complete an open task by an unambiguous ID, exact description, partial title, or narrowly fuzzy match; ambiguities are surfaced instead of silently changing state.
- `src/interfaces/cli.js` queues received lines and drains the queue after stdin closes, avoiding the v0.0.3 readline race during piped commands and slower async embeddings/inference.
- `scripts/benchmark-models.js` compares candidate models with fixed, nonprivate prompts over loopback Ollama and reports wall time and generation throughput. It does not score real-world correctness.
- CPU-only model choice is **configurable**. Start with `llama3.2:1b`, evaluate `llama3.2:3b` (2.0 GB disk footprint) and optionally another 3B model before selecting a new default. Larger models are not a substitute for deterministic tools.

Phase 0 status remains in progress until the developer performs the offline live-acceptance checklist in `docs/PHASE0_CLOSEOUT.md`.
