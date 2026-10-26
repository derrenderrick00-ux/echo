# Echo Phase 3 — Ubuntu acceptance checklist

## Environment

- [ ] Back up `.env`, `config/profile.json` and `data/` outside the repository.
- [ ] Apply the update ZIP to the Echo v0.2.0-rc.1 repository.
- [ ] `npm test` reports all tests passing under the installed Node.js 24.
- [ ] `npm start` works with Ollama unavailable; deterministic local commands still respond.
- [ ] `git status` shows no `.env`, populated profile, encryption private keys or private memory files staged.

## Natural-language tasks

- [ ] `Add a task to review networking` saves an actual task with an ID.
- [ ] `Put practice SQL on my to-do list` adds the task.
- [ ] `Show me my tasks` and `What is on my plate?` display actual saved tasks.
- [ ] `I need to study Express.js` proposes an action but does not save without approval.
- [ ] `/approve <id>` confirms and saves the proposed task.
- [ ] `Mark review networking done` completes the correct task.
- [ ] `Delete task <id>` requires explicit approval, and `/reject <id>` leaves the task intact.
- [ ] `Remind me to study Node.js` clearly says no reminder was scheduled.
- [ ] `29+76+19 step by step calculation in binary` returns `124 = 1111100₂`.
- [ ] An unsupported email request never claims that an email was sent.

## Voice

- [ ] `/voice check` reports installed Whisper/Piper paths.
- [ ] `/voice test` produces audible sound.
- [ ] `/voice ask 5` transcribes a spoken task request and asks for explicit confirmation without saving.
- [ ] A subsequent `/voice ask 5` with `confirm` saves that task.
- [ ] `cancel` discards the pending spoken task without saving.

## Manual sync trial (optional, using a second isolated test copy)

- [ ] Two test copies can initialize independent device keys.
- [ ] Only public keys are exchanged and fingerprint verified outside Echo.
- [ ] Trust requires `/approve` and `/audit` records the decision.
- [ ] Exported `.echosync` file contains no visible plaintext task descriptions.
- [ ] Receiver can preview and approve an import of a test note/task.
- [ ] Re-import creates no duplicates.
- [ ] Altered ciphertext or a conflicting ID is rejected without overwriting saved information.
- [ ] No private keys, notes, or decrypted snapshots enter Git.

## Release gate

Phase 3 is not complete until connected-tool permissions, approved network transport, multi-device independent operation and deletion/update conflict handling are validated on real target devices. This candidate is a tested local foundation only.
