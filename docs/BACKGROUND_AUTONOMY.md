# Echo v0.4 — Background Autonomy Operator Manual

## What is implemented

Echo can perform four **owner-approved unattended local report jobs** even after the Echo chat CLI closes: (1) outstanding tasks, (2) upcoming local calendar events for the next 24 hours, (3) the saved daily development review, and (4) a local memory/resource summary. These jobs use deterministic Node.js code. They **never call Ollama, use the web, access external accounts, execute arbitrary programs, edit tasks, delete records, synchronize devices, or message anyone**.

Each scheduled job is confined to one report per local calendar day, its scheduled HH:MM in `Africa/Nairobi`, and a two-hour catch-up window; unattended execution is recorded in `data/echo-background.json` and written into `data/background-inbox/*.md`. Scheduling requires an explicit local confirmation. Background work is only active when the optional systemd user timer is installed and enabled. A laptop that is powered off cannot run jobs. Systemd's user-manager lifetime determines whether jobs run after logout; optional `loginctl enable-linger` changes that behavior. No automatic escalation occurs.

## Configure a job inside Echo

```
/background help
/background schedule tasks 18:00
```

Copy the real returned ID; do not literally type `<id>`.

```
/background confirm REAL_ID
/background status
```

The command creates an approved configuration entry, **not** a running timer. A timer installation step must be performed in Ubuntu. To pause/delete jobs: `/background pause REAL_ID`, `/background resume REAL_ID`, `/background delete REAL_ID`. Audit actions with `/background audit`.

## Install the timer from the Ubuntu terminal

After `npm test` succeeds:

```bash
cd ~/Documents/echo
bash scripts/install-background-timer.sh
systemctl --user status echo-background.timer
systemctl --user list-timers --all echo-background.timer
```

The installer places templates at `~/.config/systemd/user/echo-background.{service,timer}` and starts the timer. It does not add a system-wide service, change sudoers or enable lingering. Every five minutes, systemd launches `node scripts/background-tick.js` to check for due jobs; this process exits afterward. It uses no long-running LLM process and should be lightweight on 8 GB of RAM.

To test one tick immediately:

```bash
npm run background:tick
systemctl --user start echo-background.service
journalctl --user -u echo-background.service -n 30 --no-pager
ls -lah data/background-inbox
```

A job only generates a report during its approved time window. For a quick functional test, schedule a job two or three minutes into the future, approve it, then keep the laptop on until the timer runs. Verify its report in `data/background-inbox/` and its status with `/background audit`.

Enable background work *after logging out* only if wanted:

```bash
loginctl enable-linger "$USER"
loginctl show-user "$USER" -p Linger
```

The second command should show `Linger=yes`. Be aware lingering also affects other user services and can increase battery consumption. Never use `sudo systemctl enable` for this user timer. To stop:

```bash
systemctl --user disable --now echo-background.timer
```

To undo lingering when no longer wanted:

```bash
loginctl disable-linger "$USER"
```

## Failure and privacy behavior

- A crashed tick or invalid state does not reset or overwrite saved jobs. The private report file is not a public Git artifact.
- Reports are noninteractive; the worker cannot ask for approval while you're away. **New permissions must be given interactively before a schedule is saved.**
- A filesystem lock prevents concurrent ticks. After an unexpected shutdown, a stale `data/echo-background.json.lock` may remain. Ensure no worker is running (`pgrep -af scripts/background-tick.js`) before removing a stale lock manually.
- A job attempted within a day records success or failure once. A failed job is **not automatically retried that day**; inspect the audit, correct the issue and schedule another run later if required.
- The current implementation does not support toast notifications, email, API calls, remote browsing, autonomous research, trigger subscriptions, or agent-generated action plans. Those require separate authentication, approvals, and security review.
- The private config is local JSON. If both the CLI and timer modify it at precisely the same time, last-writer behavior is possible; avoid editing jobs during a running tick. A transactional database is recommended before adding high-impact autonomous actions.

## Runtime requirements

The worker has no Ollama/Whisper/Piper dependency. `node` must be discoverable by `/usr/bin/env` in the systemd user manager. If systemd reports `node: No such file`, adapt the service template to an absolute output of `command -v node`, reload with `systemctl --user daemon-reload`, then retest. Do not enable arbitrary shell/script execution in the job list.
