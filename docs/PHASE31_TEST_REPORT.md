# Echo v0.3.1-rc.1 — Test Evidence

The development candidate was tested locally with Node.js 22 on Linux using the built-in Node test runner. The project targets Node.js 24 on Ubuntu. The final test count and routing count are recorded in the release response after package verification.

- Retained the Phase 3.0 full regression suite.
- Added realistic tests for exact base-16 output, invalid base input, task-state lookups, ambiguous matches, zero implicit persistence, manually reported review entries, private file permissions, basic code syntax parsing and curated routing cases.
- Real Ollama inference speed, Whisper/Piper microphone and speaker paths, and cross-device sync have not been measured here.
- Curated routing test success is not a generalization guarantee for unfamiliar natural-language expressions.
- The project does not execute generated code while checking JavaScript syntax.

## Candidate validation results

- Automated Node.js tests: **139 passed, 0 failed** in the local Linux/Node.js 22 environment.
- Curated deterministic intent routing: **43 of 43** test prompts routed as expected.
- Manual CLI smoke test: task creation/listing/completion/status, verified hexadecimal conversion, daily review and development log worked without calling Ollama.
- The update is intended for the user’s Node.js 24 Ubuntu installation; real-device acceptance is still pending.
