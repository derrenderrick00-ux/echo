# Echo v0.3.3 — Local learning and file creation

## What this update actually does

Echo learns **explicitly approved user preferences and user-supplied corrections** as private, persistent records. Approved preferences and topical claims can be included as limited local context in subsequent Ollama chats. This does **not** modify Llama's weights, independently fact-check claims, browse the internet, or guarantee general factual accuracy. An incorrect user correction never overrides built-in verified calculations or constants.

The v0.3.3 ZIP also includes the previously issued v0.3.2 file-creation feature, so it installs directly over v0.3.1 if the earlier v0.3.2 download was missing.

## Learning: commands entered at `you>`

```text
/learn help
/learn teach Wi-Fi | Wi-Fi is a radio networking family based on IEEE 802.11
/learn correct keyboard shortcuts | I prefer Ctrl+Shift+P for the VS Code command palette
/learn preference response_style | Give short, direct answers unless I ask for a full lesson
/learn pending
/learn confirm <proposal-id>
/learn list
/learn find Wi-Fi
/learn forget <saved-id>
```

A proposal is not saved until you confirm it. You can also say `confirm` after the latest learning proposal. Natural teaching phrases such as `Teach Echo: network ports | TCP and UDP ports identify transport endpoints` are recognized. Phrases such as `You were wrong` ask for a specific correction rather than silently storing something inferred from the conversation.

Supported preference keys: `response_style`, `study_method`, `accuracy_priority`, `current_focus`.

The `data/echo-learning.json` file is local, private, excluded from Git by `data/**`, written using a temporary file and replacement, and validated on startup. Staged proposals expire after ten minutes and disappear on exit. `forget` deactivates a record so it no longer influences answers; for privacy-sensitive deletion of all historical journal entries, manually remove the private journal after backing up any records you want to keep.

Learning journal entries are **user-supplied, unverified claims**. For technical questions, the app must still use its deterministic tools, reliable reference material, or clearly state uncertainty. Do not use the learning journal as a trusted global facts database.

## Actual file creation

The repository previously ran v0.3.1 after `unzip` failed to find v0.3.2. The model then pretended it had created `notes.md`. That output was not an actual file operation. This combined update includes a real workspace writer.

```text
Create a file called notes.md containing I'm learning JavaScript.
/file pending-tasks
/file preview <draft-id>
/file save <draft-id>
/file list
/file read pending_tasks.md
```

The pending task document is drafted from **actual open tasks**, not fabricated `Task 1` placeholders. Files are written only to `data/code-workspace`, only after a user-approved `/file save`, with a no-overwrite policy and syntax checks for JavaScript and JSON. They are neither committed to Git nor executed automatically.

For generated code, use `/file generate hello.js | Print Hello World`, then preview and approve. Any generated program remains **unverified** even if its syntax passes.

## Ubuntu installation (terminal)

1. Save the attached combined ZIP to `~/Downloads/` and confirm its filename with `ls -lh ~/Downloads/Echo_v0.3.3-rc1_learning_and_files_update.zip`.
2. Back up private `data/` and your current `.env`; keep the backup outside the repo.
3. Run `unzip -o ~/Downloads/Echo_v0.3.3-rc1_learning_and_files_update.zip -d .` from `~/Documents/echo`.
4. Run `npm install && npm test` and confirm the version is `0.3.3-rc.1`, not `0.3.1-rc.1`.
5. Run `npm start`, try the learning and file-creation scenarios above, restart, and verify persistence.

Do not paste this Markdown document into Bash. Code blocks prefixed `/learn` or `/file` are commands to enter **inside Echo**, after `npm start`.

## Boundaries and next improvements

This release does not include autonomous learning from internet pages, unsupervised model fine-tuning, safe arbitrary OS file creation, robust self-critique, or online research. Before considering model fine-tuning, collect consented high-quality corrections, test them independently, and measure factual accuracy on a held-out test set. With 8 GB RAM and CPU-only inference, a small verified retrieval layer is more practical than continuous training.
