# Echo v0.3.4 — Final Candidate Acceptance

## Preflight (Ubuntu Bash)

```bash
cd ~/Documents/echo
git status
ls -lh ~/Downloads/Echo_v0.3.4-rc1_context_interview_update.zip
mkdir -p ~/Documents/echo-private-backups/v034
cp -a data .env config/profile.json ~/Documents/echo-private-backups/v034/
unzip -o ~/Downloads/Echo_v0.3.4-rc1_context_interview_update.zip -d .
npm install
npm test
npm run evaluate
npm run test:record
npm start
```

**Expected reference automated result:** 176 tests pass, 0 fail. Ubuntu/Node.js 24 results are pending until physically executed.

## Private seed (Bash, AFTER REVIEW)

```bash
cd ~/Documents/echo
cp ~/Downloads/Echo_Private_Context_Seed_2026-10-27.json data/echo-context-seed.json
chmod 600 data/echo-context-seed.json
```

**Inside Echo:** `/context import preview`, `/context import confirm`, `/context summary`, `/context learning`, `/context projects`, `/context roadmap`. Restart and repeat `/context projects`; contents must persist. Existing populated context must not be overwritten silently.

## Interview

Run `/interview setup` in Echo on a real terminal, enter your secret twice at the hidden prompt (not as commands). Run `/interview unlock`, enter the secret; `/interview start`; answer nine questions with `skip` where appropriate; `/interview preview`; `/interview confirm`; `/context interview`. Confirm cancelled interview answers are not stored. Verify status updates using exact `Echo: active; StudyFlow: active` format. Three bad guesses should invoke local cooldown; do not paste passwords into logs.

## Smart memory

- `add to memory: task | Revise SQL` → `/task pending` lists it.
- `add to memory: note | CSS grid supports two-dimensional layouts` → `/notes` lists it.
- `add to memory: correction | JS arrow | lexical this` → learning proposal; confirm and `/learn list`.
- `add to memory: project | Echo | active | testing memory interview` → project proposal; confirm with `/context change confirm <id>`, inspect `/context projects`.
- `add to memory: completed task | Revise SQL` → `/task completed` shows done.
- `add to memory: event | 2026-11-01T09:00+03:00 | Revision` → `/event list` shows local event.

## Verified file creation

Type `create a well formated md file in pending_tasks`. Echo stages the file. Use the returned draft ID with `/file preview <id>` and `/file save <id>`. Verify `/file read pending_tasks.md` and `ls -l data/code-workspace/pending_tasks.md` from Bash. Existing filenames should not be overwritten.

## Accuracy / resources

Test the historic failures: `273 in hex` = `111`; `29+76+19 in binary` = `1111100`; task pending vs completed; C `%` dual interpretation; arrow-function parameter syntax. Verify no fabricated current web research, no false claim to write arbitrary files, and no claim that secret-based interviews retrain the LLM. Test live Whisper/Piper one-shot voice and model response latency. Note `free -h`, `ollama ps` and current inference model.

## Git signoff

```bash
cd ~/Documents/echo
git add README.md package.json package-lock.json src docs tests
git diff --cached --name-only
git diff --cached --check
git check-ignore .env config/profile.json data/echo-context.json data/echo-context-seed.json data/echo-interview-key.json
git commit -m "feat: complete Echo private context, interview and smart memory milestone"
git push
```

Do not stage the locally modified `Echo_Master_Document.md` without reviewing it. Confirm `git diff --cached --name-only` contains no private files; if it does, unstage them and investigate. Do not force push. Optional release tag after live acceptance: `git tag -a v0.3.4 -m "Echo user-accepted v0.3.4" && git push origin v0.3.4`.

## v0.4 supplementary release gates (not automatically passed)

- [ ] Confirm test suite and routing evaluation pass on Ubuntu Node 24.
- [ ] Approve one background tasks report and verify systemd executes it with CLI closed.
- [ ] Confirm pause/delete prevents further reports and verify one report/day.
- [ ] Review the background worker's local-only permissions and audit logs.
- [ ] Curate a consent-reviewed, fact-checked dataset; verify 80/20 train/holdout split.
- [ ] On a CUDA host, run actual LoRA fine-tuning and record adapter, validation loss and hardware usage.
- [ ] Compare original and tuned model on independent held-out accuracy tests before deployment.
- [ ] Run Ubuntu privacy/security, dependency audit, historical Git review and real inference benchmarks.
- [ ] Keep high-impact autonomous actions disabled until independent security approval.

See `BACKGROUND_AUTONOMY.md`, `FINE_TUNING_PIPELINE.md`, and `SECURITY_PERFORMANCE_ACCEPTANCE.md`.
