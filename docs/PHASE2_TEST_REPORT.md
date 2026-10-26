# Echo Phase 2 — Release Candidate Test Report

**Target:** v0.2.0-rc.1  
**Reference base:** Echo v0.1.0-rc.4

## Automated tests

The Node.js built-in test runner covers the prior Phase 0/1 regression tests and newly added Phase 2 tests. The Phase 2 additions test persisted idea scores, decision outcomes, preferences, restricted local file selection, symlink rejection, disabled-by-default code execution, the bubblewrap argument contract, absence of host-shell fallback, parser behavior, and low-memory warnings.

The runtime tests invoke fake Ollama and isolated-process adapters where external hardware or utilities are unavailable. Passing them does not prove real CPU inference quality, namespace availability, sandbox resistance to hostile code, or voice playback quality.

## Known limitations

- No real Linux `bwrap` exercise was conducted in the test container. Code execution remains disabled by default.
- Output quality of code generation and idea brainstorming depends on the Ollama model. Both are marked unverified.
- Idea scores are rankings of user-assigned ratings, not predicted probabilities of success.
- `data/echo-phase2.json` uses restrictive permissions but not encryption-at-rest.
- Phase 1 acceptance remains open for voice input/voice replay and background functionality.
- User's ThinkPad has recently reported less than 1 GiB available RAM. Large-model timeouts remain possible.
