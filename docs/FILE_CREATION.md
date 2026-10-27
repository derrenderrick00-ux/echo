# Echo v0.3.2 — Creating Files Safely

## Purpose

Create actual working files in `data/code-workspace/` without copying source out of the chat. Files are **private and Git-ignored**. There are no arbitrary host-path writes, file replacement or autonomous shell commands. The only supported write procedure is a draft followed by explicit approval.

## How to use it

Inside Echo (`you>` prompt), not Ubuntu Bash:

```text
/file create notes.md | This week: learn JavaScript functions
/file preview <id>
/file save <id>
/file list
/file read notes.md
```

To paste multiple lines, enter `/file paste demo.js`, then paste the JavaScript on separate lines. Enter `:end` **alone** to stage it. Read the displayed draft ID, preview it and enter `/file save <id>`. `:cancel` abandons the paste. Empty lines are retained; pasted lines are never interpreted as Echo commands.

Generate a new single file through the local model:

```text
/file generate hello.js | Print hello and handle an optional name parameter
/file preview <id>
/file save <id>
```

Or after an existing `/code generate` reply:

```text
/file from-last hello.js
/file preview <id>
/file save <id>
```

If the earlier answer contained several fenced blocks, select one with `/file from-last hello.js 2`. The language of the selected block is not guaranteed to match the extension. JS and JSON are syntax-checked before staging, but HTML/CSS/C/Python are not independently compiled or validated.

A complete, deterministic 4-file browser project:

```text
/project scaffold unit-converter
/file preview <id>
/file save <id>
/file list
```

Open `data/code-workspace/unit-converter/index.html` in a browser to run the saved project. The scaffold has dedicated unit-conversion tests but still requires interactive browser acceptance.

## File security and limits

Supported file types: `.js`, `.mjs`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.c`, `.h`, `.py`. Names are simple relative paths, with up to two folder levels. Absolute paths, dotfiles, traversal, symlink parents, and overwrites are denied. Files are created with POSIX mode 0600; workspace dirs use 0700 when newly created. Maximum 8 files and 128 KiB per draft, 48 KiB per file. Drafts expire in 15 minutes and do not survive a restart. The app will not overwrite `data/code-workspace` files that already exist.

The project does not execute file contents automatically. `/code run` remains a separate experimental Bubblewrap feature disabled by default. These checks are defense-in-depth, not a security proof against a hostile concurrent process controlled by the same OS user. Keep your workspace local and private.

## Verification

Run `npm test` before and after the update, and test each of the commands above. If an LLM-generated draft is malformed, **nothing is saved**. In that case, request a shorter single file or use the deterministic template. Voice code is unchanged.
