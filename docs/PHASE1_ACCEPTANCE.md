# Echo Phase 1 — Real-hardware acceptance checklist

Tests bundled with this release verify modules with fake services; this checklist requires a live Ubuntu test using real Ollama and, if desired, optional speech engines.

## Verification

```bash
cd ~/Documents/echo
npm install
npm test
node src/echo.js --status
ollama list
ollama ps
npm start
```

Confirm Phase 0 is marked `complete` and Phase 1 is `in-progress`.

## 1.1 Accuracy and dialogue

- [ ] `what date is today` returns the system date rather than a language-model guess.
- [ ] `show me the menu` lists only commands accepted by the app.
- [ ] `what are my current tasks` reads actual saved tasks.
- [ ] `show me the calculation process for 43 + 97 in binary` ends with `10001100₂ = 140₁₀`.
- [ ] `add to memory that I'm learning SQL`, followed by `/notes`, proves real persistence.
- [ ] Ask for detailed technical explanations, test `/continue`, and record actual errors and token limits.
- [ ] No incorrect claim of external messages, calendar sync, training or autonomous actions.

## 1.2 Calendar and routine

- [ ] Add a future event with `/event add 2026-11-01T09:00+03:00 | Study algorithms`.
- [ ] `/event list` shows it; restart Echo and confirm persistence.
- [ ] `/brief morning` and `/brief evening` include stored tasks and local events but no invented external appointments.
- [ ] Test a due alert while Echo is running; do not assume alerts while it is closed.

## 1.3 Summary and decision support

- [ ] `/summarize We need to revise networking. I should finish the report tomorrow.` contains no invented details.
- [ ] `/decide SQLite | PostgreSQL` identifies assumptions and potential uncertainty. Independently check technical claims.

## 1.4 Optional offline voice with on-demand two-way interactions

Use `bash scripts/setup-voice-ubuntu.sh` from a normal Ubuntu shell after reviewing the script. Read `docs/VOICE_SETUP_UBUNTU.md` for individual verification commands and model path settings. Piper needs an `.onnx` file and matching `.onnx.json` configuration file; Whisper needs a `.bin` model.

- [ ] Confirm speaker test works using `aplay ~/Documents/echo-local-tools/test-echo-voice.wav`.
- [ ] Confirm microphone capture with `arecord` and replay the test WAV.
- [ ] Configure the five voice entries in your ignored `.env` and restart Echo.
- [ ] `/voice check` reports that Whisper/Piper model files and executables are present, without claiming actual device operation.
- [ ] `/voice speak Hello Echo` produces audible speech on the device.
- [ ] `/voice listen 5` recognizes a known sentence.
- [ ] `/voice ask 5` transcribes and answers a spoken question in text.
- [ ] `/voice chat 5` transcribes a spoken question and plays its spoken answer.
- [ ] `/voice on` speaks subsequent typed replies; `/voice off` disables spoken replies.
- [ ] `answer in voice what is 43 + 97 in binary` speaks the deterministic correct result for one question.
- [ ] `/voice reply` speaks the last substantive answer, including exact math results.
- [ ] Missing Piper `.onnx` files, unconfigured Whisper, or playback failure produce actionable errors without claiming speech succeeded.
- [ ] Microphone commands that could modify notes/tasks request typed confirmation.
- [ ] No continuous microphone recording or wake-word listening occurs.

## 1.5 Privacy and regression

```bash
git check-ignore .env config/profile.json data/echo-memory.json data/echo-calendar.json
git status --short
git diff --cached --name-only
```

Check public docs for names, locations, personal histories or credentials. Replacing a public file in a new commit does not erase previous versions from Git history. This update does not rewrite Git history.

## RC2 targeted regressions

- [ ] `/date` and `what is today's date` use the device clock and configured timezone.
- [ ] `43 + 97 in binary` reports `10001100₂`; `just direct answer` immediately afterward reports the same calculation concisely.
- [ ] `i need a direct answer on 43 + 97 in binary` does not enter the local LLM.
- [ ] `i want you to respond with voice` enables spoken replies only when local voice files and tools pass checks; it reports missing dependencies otherwise.
- [ ] `/voice setup` links to the accurate Whisper/Piper installation steps.
- [ ] `/diagnostics` and asking about an Ollama stream timeout return verified runtime information.
- [ ] Real Piper speech and Whisper transcription work only after installing their binaries and models on Ubuntu.
