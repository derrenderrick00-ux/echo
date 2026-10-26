# Echo Phase 1 v0.1.0-rc.1 — Test Report

**Environment:** ChatGPT sandbox, Node.js 22.16.0, Linux x86_64. Echo specifies Node.js 24 for the target Ubuntu installation; that target version has **not** been tested here.

**Automated tests:** 59 passed, 0 failed, using Node.js built-in `node:test` and simulated dependencies. Includes the 43 tests from the previous baseline, with phase-status and capabilities assertions updated, plus 16 new Phase 1 tests.

**Coverage sampled:**

- CLI piped input processing and simulated Ollama streaming, persistence and error fallback.
- Arithmetic, binary-column addition, date/time, commands and natural-language memory requests.
- Private profile injection boundaries and note/task persistence.
- Calendar persistence, timestamp validation, event deletion, and one-time due event notifications using a fake clock.
- Manual briefing structure, extractive summaries, decision prompt construction, game state and quit behavior.
- Optional voice missing-model errors, mocked Whisper transcription and mocked Piper playback invocation.
- Scan of public master specification for identifying personal profile fields.

**Additional CLI smoke test:** A piped sequence used `/status`, date, menu, binary addition, local calendar add/list, morning briefing, trivia and quit, then exited cleanly with process exit code 0. The calculation 43 + 97 produced 140 decimal and 10001100 binary with column-by-column carries.

**Not tested:** Real Ollama model factual accuracy or latency; real STT/TTS executables, microphone or speaker; accurate calendar alarms when the CLI is closed; encrypted sync; mobile clients; automation; Windows target build. Passing these tests does **not** mean Phase 1 is finished.

**Privacy:** Test data used synthetic examples. The patch contains no `.env`, private profile, personal memory or saved calendar file. The Git repository's previous history is not modified by these generated files.

## RC2 regression update

Eight new regression tests were added for direct binary answers, date variants, voice claims and setup, timeout diagnostics, configuration validation, and modern Piper module invocation. The 67-test suite passed in a Node.js 22 Linux test environment. Real speech input/output and Ollama inference still require testing on the target Ubuntu system.


## RC3 voice interaction update

Twelve automated tests were added for one-shot spoken responses, session voice toggling, microphone-driven questions, safe typed confirmation of transcribed state-changing commands, missing model checks, and piped CLI playback orchestration. The resulting **79 tests passed** in a Linux x86_64 test environment running Node.js 22.16.0. Physical speakers, microphone, real Whisper and Piper execution, and Node.js 24 runtime remain unverified in this environment.

`/voice check` validates local model files and executable presence; it does not verify that the audio devices work. The Ubuntu voice installation script was syntax-checked but was not executed here, as it downloads binaries/models and needs the target computer's audio devices.
