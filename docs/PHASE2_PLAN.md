# Echo — Phase 2: Coding, Ideation and Deeper Personalization

**Candidate release:** 0.2.0-rc.1  
**Status:** In progress. Phase 1 still awaits complete voice and background-routine acceptance.

## Planned milestones

| Milestone | Scope | Candidate status |
| --- | --- | --- |
| 2.1 | Code generation, explanation and static review using local LLM | Implemented; model accuracy not guaranteed |
| 2.2 | Bounded, isolated execution of user-approved JavaScript | Implemented behind explicit opt-in; disabled by default pending Ubuntu sandbox/security validation |
| 2.3 | Capture, rate, compare and brainstorm software ideas | Implemented; scores reflect user ratings, not objective probabilities |
| 2.4 | Decision journal with explicit choices, reasoning and outcomes | Implemented with local persistence and exact lookup |
| 2.5 | Explicit personalization preferences and memory-aware prompt extension | Implemented conservatively; live reasoning evaluation pending |

## Architecture

```
Echo CLI -> AssistantController -> Phase2Commands
                                     |-> Phase2Workspace (private JSON)
                                     |-> CodeSandbox (disabled unless explicitly opted in)
                                     |-> ConversationSession -> Ollama (for code and brainstorming)
```

No Phase 2 feature writes to personal data except through explicit typed commands. Spoken commands that modify data are rejected pending confirmation. The explicit preferences are included in bounded local context; decisions and ideas are not sent to the LLM automatically. The program does not retrain local model weights.

## Exact commands

```
/phase2 help
/phase2 status
/resources
/idea add Offline tracker | impact=5 | learning=5 | feasibility=4 | effort=2
/idea list
/idea rank
/idea brainstorm improve offline study tracking
/decision add SQLite or PostgreSQL? | SQLite | Easier small offline prototype
/decision list
/decision find SQLite
/decision outcome <id> | Prototype tested successfully
/preference set accuracy_priority | Verify claims and avoid untested assertions
/preference set study_method | State, define, explain, illustrate, practice
/preference list
/preference clear study_method
/code check
/code files
/code explain demo.js
/code review demo.js
/code generate Small Node.js CLI that validates positive numbers
/code run demo.js
```

## Code workspace

`data/code-workspace/` is private and excluded from Git. Create your own `demo.js` there using an editor. Only direct `.js`/`.mjs` filenames and files of at most 16 KiB are supported for code operations. Source reading is restricted to this workspace and rejects symlink escapes. Echo does not execute its generated code automatically.

**Execution is OFF by default.** Code execution should remain off unless the operating system, bubblewrap package, and AppArmor namespace policy have been reviewed and tested. For experimental use on a verified system, the operator can set `ECHO_EXPERIMENTAL_CODE_EXECUTION=1` in `.env` and install `bubblewrap`; if isolation cannot initialize, Echo refuses to run the code. There is no unsafe host-execution fallback. Even an isolated runner is not a guarantee against hostile code: Bubblewrap and kernel vulnerabilities can defeat isolation. Do not run untrusted scripts while the local security status is unresolved.

The sandbox attempts to mount just the required runtime and selected source file, uses a new user/network/pid/mount namespace, denies host-home directory bindings, limits Node heap usage, imposes a four-second wall timeout, and limits output. It still requires testing on the target Linux system; automated tests mock its external process.

## Privacy

- Keep `.env`, `config/profile.json`, `data/echo-memory.json`, `data/echo-calendar.json`, `data/echo-phase2.json`, and `data/code-workspace/` out of Git.
- Local stores use user-only POSIX permissions; they do **not** provide encryption at rest.
- Public master document is the sanitized technical specification. Older private versions are still present in Git history unless specifically rewritten.
- An LLM-generated code snippet or brainstorm is a proposal, not a verified result.
