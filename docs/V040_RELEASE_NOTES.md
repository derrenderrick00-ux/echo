# Echo v0.4.0-rc.1 — Background / Fine-Tuning / Acceptance Release Notes

**Baseline:** v0.3.4-rc.1 (user-reported commit `42b4f2d`). 27 October 2026.

## Implemented and locally verified

- User-approved recurring report jobs for tasks, calendar, daily review and resource snapshot. A separate Node worker can run through a Linux systemd user timer even when the chat CLI is closed. No unrestricted tool execution or network actions are available to the worker.
- Background job proposal/confirmation, pause, resume, delete and bounded audit output. Scheduled actions are limited to private reports, with day-level idempotency, a two-hour catch-up window and process-level lock.
- Reviewed training prompt/ideal-answer journal, explicit confirmation and private 80/20 train/held-out JSONL export. No automatic collection of conversation data.
- An *executable* LoRA/QLoRA fine-tuning script for a compatible CUDA machine. It does not train model weights unless run there. Training and adapter deployment were **not run in the build environment**.
- Security static preflight covering tracked private files, file permissions and known remaining manual security gates; private JSON report. Deterministic performance benchmark and optional local-Ollama smoke benchmark.
- Current preflight on Node.js v22 Linux (not the user's Ubuntu Node.js 24): 184 automated tests passed, 43/43 curated routing cases passed. Deterministic arithmetic p95 and RSS benchmark passed. `security:check` verdict **PARTIAL** because target Git history, dependency audit, credentials and manual testing remain.

## Not yet implemented or accepted

- General-purpose autonomous agent planning, unrestricted shell/app actions, internet browsing, independent external research, texting/telephony, cloud operations, autonomous software modification or auto-training.
- GUI notifications, automatic multi-device network sync, transaction-safe concurrent scheduling and high-impact unattended effects.
- A trained LoRA adapter, converted Ollama model, or measured model-quality improvement. CUDA/VRAM training compatibility has not been tested.
- Full security certification, target-host penetration testing, recovery testing, dependency vulnerability clearance, CPU/Ollama p95 and 8-GB end-to-end performance acceptance.

## Installation and backout

1. Save a private backup of `data/`, `.env`, and `config/profile.json` **outside the Git repository** before extracting.
2. Check `git status`; keep personal modifications to `Echo_Master_Document.md` unstaged.
3. Apply the update ZIP at the repository root: `unzip -o ~/Downloads/Echo_v0.4.0-rc1_background_training_security_update.zip -d .`.
4. Run `npm install && npm run acceptance:preflight`. The latter checks automated code paths, intent routing, security preflight and deterministic performance. Read all WARNs; successful exit is **not** full acceptance.
5. Start `npm start`; try `/background help`, `/background schedule tasks 18:00` and `/train help`. Do not install the timer until you explicitly approve a job and are ready for unattended runs.
6. If you want the timer, run `bash scripts/install-background-timer.sh` in Ubuntu; check `systemctl --user list-timers --all echo-background.timer`.
7. For rollback, stop the timer (`systemctl --user disable --now echo-background.timer`), reset only the intentionally tracked code files to your prior commit, and restore any private data separately from your backup. Do not use `git reset --hard` until you have saved your separately edited master document.

## Git hygiene

The ZIP does not include private data or the populated profile/seed. Stage only `README.md .gitignore package.json package-lock.json src docs tests scripts systemd training` and review `git diff --cached --name-only`. Never add `data/`, `.env`, `config/profile.json`, or personal exported training sets.

## Documentation

- `BACKGROUND_AUTONOMY.md` — scheduling and systemd details
- `FINE_TUNING_PIPELINE.md` — data curation, GPU training, held-out evaluation, adapter compatibility
- `SECURITY_PERFORMANCE_ACCEPTANCE.md` — check commands, caveats, signoff matrix
