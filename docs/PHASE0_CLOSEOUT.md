# Phase 0 Closeout — Echo v0.0.4

**Source:** Echo Master Document, Part 1, Section 5, Phase 0.

**Goal:** Basic local chat, personal profile, simple vector store for notes, and on-demand routine summary. Exit criterion: the user can chat with a local model that reflects basic style and retrieves personal notes.

**Current status:** Release candidate, pending live user acceptance. Do NOT mark Phase 0 complete merely because automated tests pass.

## Automated

```bash
cd ~/Documents/echo
npm test
```

All tests should pass. If a test fails, record its exact output and resolve it before transition.

## Live acceptance checklist

- [ ] `/profile` confirms the private profile is loaded; `/identity` correctly distinguishes Derrick and Echo.
- [ ] The model answers a simple question without internet after required model downloads.
- [ ] `/remember I am revising Express.js` confirms saved note; `/notes` displays it.
- [ ] `/recall backend framework` finds an appropriate note (results may vary; verify exact keyword recall too).
- [ ] Restart Echo; `/notes` still displays the same note.
- [ ] `/task add Complete networking revesion`; then `I have completed networking revision`; `/task list` shows `[x]`.
- [ ] `/routine` lists only manually saved tasks and profile priorities, not invented scheduled events.
- [ ] `980 convert to binary` is `1111010100`; `1000 to base 2` is `1111101000`.
- [ ] `What can you do?` lists real capabilities and distinguishes planned ones.
- [ ] `What is my study method?` gives a profile-grounded answer *if the method is in the private profile or saved notes*; otherwise Echo admits it does not know.
- [ ] `git check-ignore .env config/profile.json data/echo-memory.json` confirms local private files remain excluded.
- [ ] Test CPU, memory and response speed for the selected Ollama model; avoid swapping to disk under normal workload.

## Important remaining limitations (not Phase 0 blockers)

- The LLM may still hallucinate; v0.0.4 uses deterministic math/task operations for selected requests, but complex reasoning remains probabilistic.
- Limited natural-language routing only handles explicitly recognized patterns. Casual conversation is not automatically remembered.
- Trivia/number games don't have proper state machines or a reliable `q` quit mechanism.
- A more capable 3B model can improve some answers, but CPU-only response latency can worsen.
- Calendar, actual notifications, speech I/O, and richer dialogue management belong to Phase 1 or later.

## Phase transition

Only after acceptance, change Phase 0 status to `complete` and Phase 1 to `in-progress` in `src/phases/phase-00.js` and `phase-01.js` in a dedicated commit, update the status test, and tag a Phase 0 release if desired. Do **not** advance by editing statuses before verification.

Suggested milestone order for Phase 1: 1.1 dialogue management and correction handling; 1.2 tasks, routine scheduling and calendar abstraction; 1.3 note capture/summarization and decision support; 1.4 local speech input/output; 1.5 acceptance, resource and safety testing.
