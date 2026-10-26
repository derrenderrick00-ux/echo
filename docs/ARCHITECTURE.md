# Echo — Phase 1 Candidate Architecture

```text
CLI ── AssistantController ── deterministic commands ── trusted local tools
                      │                ├── MemoryStore (notes and tasks)
                      │                ├── LocalCalendar (events)
                      │                ├── Mathematics, date and time
                      │                ├── Briefings, extractive summaries, games
                      │                └── LocalVoice (optional Whisper + Piper)
                      └── ConversationSession ── OllamaProvider ── local model
```

`src/echo.js` wires dependencies, while `src/interfaces/cli.js` handles prompts and asynchronous input. `src/core/assistant.js` processes explicit commands and bounded natural-language patterns before involving the model. Modules under `src/core/`, `src/memory/` and `src/providers/` are reusable beyond the CLI.

Phase 1.1 adds deterministic task/note/date requests, an improved prompt contract, a controlled game engine and `/continue`. Phase 1.2 adds a local event calendar, scheduled checks **only while CLI is open** and manual briefings. Phase 1.3 adds extractive text summarization and option comparison. Phase 1.4 provides a local speech adapter but requires external binaries and model files. Phase 1.5 adds test fixtures and acceptance guidance.

Calendar entries use explicitly offset-qualified timestamps (e.g. `2026-11-01T09:00+03:00`); the application uses `Intl` for the configured display timezone. Old notes/tasks remain in `data/echo-memory.json`, and calendar data lives in `data/echo-calendar.json`. Files have `0600` permissions, directories `0700`, but are not encrypted.

### Safety and reliability boundaries

- Unrecognized free-form requests still reach the local LLM and may be inaccurate; answers must not be treated as verified facts.
- The app confirms a note, task or appointment only after the local store reports success. Model claims cannot mutate application state.
- Calendar events stored while offline are not synchronized to external calendars.
- The in-process event checker is **not** a reliable system-level notification or always-on background service.
- Game answers are deterministic and independent from LLM context.
- Whisper microphone capture and Piper playback are optional; voice capabilities are not advertised as configured when the model path is blank.
- Transcripts are not automatically executed or saved as commands.
- External emails, phone actions, computer control, automatic browsing, cross-device encrypted sync and always-on agents remain outside the current implementation.
