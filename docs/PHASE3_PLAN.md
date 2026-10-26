# Echo Phase 3 — Permissioned actions and multi-device foundation

**Release:** v0.3.0-rc.1

**Status:** Experimental Phase 3 baseline. Phases 1 and 2 retain outstanding live acceptance requirements.

## Guiding rule

Echo must never claim a side effect occurred unless a local application tool confirms it. Natural-language task commands use deterministic rules. Ambiguous statements produce an approval proposal instead of silently modifying records. LLM text cannot approve actions or invoke a shell or network service.

## Milestones

| Milestone | Deliverable | Status |
| --- | --- | --- |
| 3.1 | Common natural-language task commands and optional two-turn voice confirmation | Implemented and tested with simulated audio |
| 3.2 | Local approval queue, 15-minute expiry, execution and append-style audit | Implemented initial subset |
| 3.3 | X25519 device keypair and authenticated AES-256-GCM manual note/task snapshot transfer | Implemented initial subset |
| 3.4 | Browser/email/cloud tools with permission gating and hybrid model selection | Not implemented |
| 3.5 | Automatic network sync, Android and Windows independent execution, conflicts and deletion propagation | Not implemented |

## Natural-language examples

- `Add networking revision to my tasks` creates a task and confirms the saved ID.
- `Can you please add SQL practice to my to-do list?` creates a task.
- `Remind me to study JavaScript` saves a task but **does not** schedule an alarm or notification.
- `I need to study Express.js` creates a proposed task. It is saved only after `/approve <id>`.
- `Mark networking revision done` completes a matching open task or shows ambiguous candidates.
- `What is on my plate?` lists local tasks.
- `Delete task <id>` creates an approval proposal. Nothing is deleted until `/approve <id>`.
- `Email my teacher` explicitly reports unsupported rather than claiming a message was sent.

## Permission controls

`/actions` lists pending proposals, `/approve <id>` executes a proposed local action, `/reject <id>` cancels it, and `/audit` reports local outcomes. Proposals expire after 15 minutes. Recorded actions include task additions through natural statements, task/note deletions, accepting a device public key, and importing an encrypted snapshot.

The audit is an ordinary local JSON file with restrictive POSIX permissions, not tamper-proof storage. It provides a basic operational history, not production-grade nonrepudiation.

## Manual encrypted device transfer

The `/device init` command generates a local X25519 keypair. Never share `data/sync/device-private.pem`.

1. On device A, run `/device init`. On device B, run `/device init`.
2. Copy each device's **public** `data/sync/device-public.pem` into the other device's `data/sync/inbox/` as a distinct `.pem` filename. This is a manual file transfer; no transport is built in.
3. On device A, run `/device trust peer.pem`. Compare the displayed key fingerprint against device B through a separate trusted channel; then `/approve <id>`. Do the reciprocal process on device B.
4. On A, run `/device peers`; use the displayed device ID for `/sync export <device-id>`.
5. Copy the `.echosync` file from A's `data/sync/outbox/` into B's `data/sync/inbox/`.
6. On B, run `/sync preview <filename.echosync>`, then `/sync import <filename.echosync>` and `/approve <id>`.

Snapshots are encrypted for the trusted destination using a shared X25519 secret, HKDF-SHA256 and AES-256-GCM. The receiver authenticates the sender based on the **manually trusted** public key. Public-key fingerprints must be verified independently to prevent an impostor from being trusted during pairing.

**Limits:** Only notes and task records are exported. Neither personal profiles, raw chats, files, calendar events, nor Phase 2 workspace entries are exported. Import is additive and idempotent for identical records. Conflicting records stop the import; existing records are not overwritten. Updates and deletions are not propagated. No automatic transfers, discovery, cloud relay, or background sync exist. Memory data remains plaintext on disk unless your device provides full-disk encryption. There is no guarantee that Android can run this Node-based CLI.

A future release requires versioned record updates, deletion tombstones, per-device permissions, an authenticated transport and conflict resolution before automatic sync is safe.

## Resource strategy

On an 8 GB CPU-only laptop, keep the Echo CLI responsive by using deterministic routes for tasks, date/time, maths and action approval. These require no LLM generation. The 1B model remains a faster option; the 3B model remains available for more capable generation if RAM permits. `/resources` reports actual OS memory availability.

## Security boundary

LLM generations cannot trigger tool execution. `/code run` stays disabled by default, as in Phase 2. Sync reads only simple filename entries in `data/sync/inbox` and rejects symlinks. Device pairing and snapshot imports require local typed approval. Do not copy the `data/` directory into GitHub or share unencrypted local memory backups.
