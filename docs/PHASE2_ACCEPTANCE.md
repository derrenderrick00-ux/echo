# Echo Phase 2 — Ubuntu acceptance checks

Use these tests from an Ubuntu terminal and Echo's `you>` prompt as indicated. This version has automated coverage but has **not** passed real Ollama or Bubblewrap tests on the ThinkPad.

## 1. Preparation

```
cd ~/Documents/echo
git status
npm install
npm test
free -h
ollama ps
npm start
```

The final release candidate must pass all automated tests on Node.js 24 and leave existing private notes/tasks/calendar intact.

## 2. Local structured features — inside Echo

```
/phase2 status
/resources
/idea add Demo note tool | impact=4 | learning=5 | feasibility=4 | effort=2
/idea rank
/decision add Use JSON or SQLite? | JSON for prototype | Already working offline
/decision list
/preference set accuracy_priority | Prefer correct, verifiable answers over quick guesses
/preference list
/exit
```

Restart Echo and use `/idea list`, `/decision list`, `/preference list`. All added records must persist. Use `/decision outcome <id> | Result` with an actual ID from `/decision list`, restart again, and verify the outcome persisted.

## 3. Code analysis

From Ubuntu, create a file in the private workspace:

```
mkdir -p -m 700 ~/Documents/echo/data/code-workspace
printf 'console.log(2 + 3);\n' > ~/Documents/echo/data/code-workspace/demo.js
```

Inside Echo:

```
/code check
/code files
/code explain demo.js
/code review demo.js
/code generate JavaScript function validating an integer
```

Generation and review require Ollama and will be slower than structured commands. Echo must not report generated code as executed or verified.

`/code run demo.js` should refuse by default. Do **not** enable execution on a machine with unresolved sandbox security advisories or namespace restrictions. A tested, patched Linux environment and explicit operator opt-in are required for execution acceptance.

## 4. Performance and privacy

Check available memory before loading 3B. Avoid running Llama 3.2 3B together with multiple browser tabs if `free -h` reports less than 1 GiB available. Smaller models are a fallback for offline coding when memory is constrained.

```
git check-ignore .env config/profile.json data/echo-memory.json data/echo-calendar.json data/echo-phase2.json data/code-workspace/demo.js
git status
```

If an ignored path is not returned, fix `.gitignore` before staging anything.

## 5. Remaining Phase 1 blockers

- Confirm microphone capture/transcription with `/voice listen 5` or `/voice ask 5`.
- Confirm `/voice on` playback after a local deterministic response and a model-generated response.
- Measure Ollama timeouts under normal multitasking load.
- Verify calendar due-event behavior and limitation to open CLI sessions.

Phase 2 may be under active development without falsely marking Phase 1 complete.
