# Echo v0.3.3 — Ubuntu acceptance checklist

## Preflight (Bash)

- [ ] Confirm the ZIP really exists: `ls -lh ~/Downloads/Echo_v0.3.3-rc1_learning_and_files_update.zip`.
- [ ] Make a private backup of `~/Documents/echo/data/`, `.env`, and the profile.
- [ ] From `~/Documents/echo`, unzip the update. Check that `npm test` reports **164 passing tests** and `npm start` reports version **v0.3.3-rc.1**.

## Learning (type these at Echo's `you>` prompt)

- [ ] `/learn list` initially shows zero entries or only entries you actually taught Echo.
- [ ] `/learn teach computer networks | Routers forward packets between networks` produces a proposal, not a saved record.
- [ ] `/learn pending` shows that proposal.
- [ ] `/learn confirm <id>` saves it.
- [ ] `/learn find computer networks` retrieves the entry and labels it **user-supplied, not independently verified**.
- [ ] `/learn preference response_style | Keep normal answers short; expand only when requested` returns a proposal.
- [ ] `/learn confirm <id>` saves the style preference.
- [ ] Say `You were wrong.` It should request the exact correction, not guess what to learn.
- [ ] `/learn correct Planck constant | 3.0 x 10^8` followed by confirmation must not override Echo's hard-coded correct SI constant in normal fact queries.
- [ ] Exit and restart Echo; `/learn list` still contains your approved learning entries.
- [ ] `/learn forget <saved-id>` deactivates one entry. It should no longer be returned by `/learn find`.

## File writer (Echo CLI)

- [ ] `Create a file called notes.md containing I'm learning JavaScript` returns a **draft**. Check that no file exists yet.
- [ ] `/file preview <id>` shows its contents.
- [ ] `/file save <id>` confirms a successful write to `data/code-workspace/notes.md`.
- [ ] `/file list` and `/file read notes.md` show the actual saved file.
- [ ] `Create a well formatted md file on my pending tasks` drafts `pending_tasks.md` containing actual incomplete task names, not placeholders.
- [ ] Saving a draft cannot silently overwrite a file that already exists.
- [ ] An unsupported request such as `create a file with no name` must say **no file was created**, not invent a directory or claim success.

## Unchanged features

- [ ] `/task pending`, `/review today`, verified arithmetic, and `/voice test` continue to work.
- [ ] Existing `.env`, `config/profile.json`, tasks, notes, saved calendar and Echo_Master_Document.md remain unchanged.
- [ ] Run `git status`; only intended public source changes should be staged in a new commit.

**Scope:** The tests validate local persistence, routing, and file writes. They do not measure general LLM factual accuracy or mean that the model retrains itself. Learning entries are not automatically verified. Ubuntu live acceptance remains separate from the Linux test-environment suite.
