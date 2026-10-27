# Echo v0.4 — Security and Performance Acceptance

This is a **release candidate**. No automated test suite is a substitute for a penetration test, full software bill-of-materials analysis, privacy review, real microphone test, or a benchmark on the target ThinkPad. The scripts below record what was observed and what remains untested.

## Security design invariants

- Never execute generated code or arbitrary commands from unattended agents.
- Background jobs are limited to local reports, scheduled and approved by the user. There is no unattended browser/network/phone/email tool.
- Runtime state and training data belong under `data/` (Git-ignored); background service has limited memory and no elevated privileges.
- Unrecognized user input is not an authority to overwrite saved notes, tasks, profile or files.
- Imported training examples are not inherently factual. Fine-tuning and deployment are separate explicit actions.
- A startup or storage error must fail visibly without resetting corrupted files.

## Run these commands from Ubuntu

```bash
cd ~/Documents/echo
npm test
npm run evaluate
npm run test:record
npm run security:check
npm run performance:check
npm run acceptance:ollama
npm audit --omit=dev
```

Expected on v0.4: all Node tests and curated intent cases pass. `security:check` writes `data/echo-security-acceptance.json` and reports `PARTIAL` if no programmatic failure was detected, **because dependency, Git-history, Bubblewrap and privacy reviews remain**. Do not interpret PARTIAL as final clearance. `performance:check` measures only deterministic arithmetic p95 latency and Node process RSS in an isolated script, not model latency. The default p95 threshold is 100ms and is configurable with `ECHO_DETERMINISTIC_P95_LIMIT_MS`; verify changes against your own hardware baseline before changing thresholds.

## Live CPU/Ollama tests

```bash
free -h
ollama ps
npm run benchmark
journalctl -u ollama -n 40 --no-pager
```

The `benchmark` script is present in earlier releases; inspect its output for actual latency on your 3B model, memory pressure, incomplete or timed-out responses. Collect p50/p95 response latency with repeated trials, include initial cold-load and warm responses, check timeouts and error rates. Compare `llama3.2:1b` versus `llama3.2:3b` on the same prompt corpus. Do not label a faster but less accurate model as an unconditional upgrade.

## Linux systemd acceptance

Use `systemctl --user list-timers --all echo-background.timer`, `journalctl --user -u echo-background.service -n 50 --no-pager`, and review `data/background-inbox`. Verify (a) one report for an approved job, (b) no report for unapproved job, (c) no duplicate report after tick, (d) pause and delete work, and (e) disabled timer produces no unattended work. Check no network activity or external OS effects.

## Further manual security work required

- Inspect all staged files before committing (`git diff --cached --name-only`); confirm `.env`, private seed, personal profile, interview key, backups and `data/` are absent. Historical commits may still contain previously exposed profile details; history rewriting is a separate deliberate decision.
- Review `.env` permissions; restrict with `chmod 600 .env`. Use `find data -type f -perm /077 -print` to identify permissive runtime files.
- Run `npm audit --omit=dev` against current registry metadata. Audit Python GPU requirements on the training host separately; exact Python dependencies are *not* locked.
- Evaluate symlink/hardlink and file-import attacks, race conditions between CLI and timer, accidental sensitive logging, and test user-owned directory permissions.
- The existing Bubblewrap code execution remains experimentally disabled; independent sandbox review is required before enabling it.
- Confirm device-to-device sync with two real trusted devices using fingerprint validation, replay/tamper tests and backup recovery. No automatic remote sync was added in v0.4.
- Test resilience to power loss and partial writes. Background reports are small local files, but the scheduler currently uses a JSON store, not a transactional database. Migrate before supporting money transfers, deletions or other high-impact autonomous actions.

## Signoff matrix

| Gate | CI/local build | User ThinkPad | Decision |
|---|---|---|---|
| Node regressions and intent routing | Run and record result | Rerun | Required |
| Background approved reports | Unit tests | Real timer acceptance | Required |
| Background privilege/network confinement | Design review | systemd review | Pending independent review |
| Fine-tuning export | Unit tests + dry-run | Curate reviewed examples | Required before training |
| Actual fine-tuning | Not run without CUDA | CUDA GPU machine | Not accepted yet |
| Trained-adapter quality comparison | Not run | Held-out benchmark | Not accepted yet |
| CPU/RAM inference performance | Not measured in this build | Benchmark | Pending |
| Security vulnerabilities | No network audit in build | `npm audit` and manual review | Pending |
| Final production security acceptance | Not claimed | Independent review | Pending |

Until all relevant gates are met, describe this release as **v0.4.0-rc.1**, not fully hardened or production certified.

### Local-model smoke metrics

`npm run acceptance:ollama` sends three small prompts to local Ollama, records wall-clock time, result text snippets and heuristic pass/fail in `data/echo-ollama-acceptance.json`. **It can take several minutes on your CPU.** It does not contact cloud servers or grade Echo's deterministic routing. Set `ECHO_OLLAMA_MODEL=llama3.2:1b` or `llama3.2:3b` in your shell before running to choose a locally installed model. The heuristic checks are deliberately small and must not be represented as a general accuracy score. If any request fails, the command exits unsuccessfully and records that failure.
