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

## 1.4 Optional offline voice

Check tools before testing speech:

```bash
command -v whisper-cli
command -v piper
command -v arecord
command -v aplay
```

Install local binaries/models through their official projects and set `ECHO_WHISPER_MODEL` and `ECHO_PIPER_MODEL` to absolute file paths in the **private** `.env`. Only then try `/voice status`, `/voice listen 5`, `/voice transcribe /path/file.wav`, and `/voice speak Hello`. If binaries or audio devices are missing, voice remains unverified rather than implemented-and-working.

## 1.5 Privacy and regression

```bash
git check-ignore .env config/profile.json data/echo-memory.json data/echo-calendar.json
git status --short
git diff --cached --name-only
```

Check public docs for names, locations, personal histories or credentials. Replacing a public file in a new commit does not erase previous versions from Git history. This update does not rewrite Git history.
