# Echo v0.3.2 — File Creation Acceptance Checklist

Version: v0.3.2-rc.1. Use these steps in the local Ubuntu repository and Echo CLI. File writes are contained in `data/code-workspace/`.

1. Run `npm test` and expect 151/151 passing; tests use Node.js 22 in the build environment, so verify on your installed Node.js 24.
2. In Echo: `Create a file called notes.md containing I am practicing JavaScript`. Confirm Echo prints a draft ID and explicitly says nothing has been written.
3. Run `/file preview <ID>`, then `/file save <ID>`. Confirm `/file list` and `/file read notes.md` return the new file.
4. Run `/file paste demo.js`, paste two lines (`const n = 2;` and `console.log(n);`), finish with `:end` on its own line, inspect and approve the resulting draft.
5. Repeat the name `demo.js` and verify Echo refuses to overwrite it.
6. Run `/project scaffold unit-converter`, preview the staged files, and `/file save <ID>`. Open `data/code-workspace/unit-converter/index.html` in Firefox; check 1 metre = 100 centimetres and 0 °C = 32 °F. This browser check is not covered by a real-browser automated test in the build environment.
7. Ask Echo `/file generate hello2.js | Print hello`. Examine the draft. The 3B LLM might return incomplete or invalid code; in that case Echo must refuse drafting it rather than claim success.
8. Attempt `create a file called ../outside.js containing console.log(1)` and verify it is rejected.
9. Test `/voice test` and `/voice chat 5` if you want; voice code is not modified by this update.
10. Verify `git status` does not include your created files or private data, and `git check-ignore data/code-workspace/demo.js` reports the path as ignored.

Limitations: only explicitly approved new files in a private workspace, no replacement of existing files, no writing outside that workspace, and no auto-execution. JS/JSON syntax validation is not a guarantee of correct logic, security, or a complete working application. The unit-converter scaffold is deterministic and has calculation tests, but you must still test the user interface on Ubuntu.
