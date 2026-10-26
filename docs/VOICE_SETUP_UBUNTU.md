# Echo — Local Voice Setup on Ubuntu

Voice is optional, offline after installation, and activated only when requested. It does not listen continuously and has no wake word.

## 1. Install the tools

The text in this Markdown document is not a Bash script. Run only the commands inside Bash code blocks at the Ubuntu `$` prompt. Commands beginning `/voice` belong inside Echo at the `you>` prompt.

From a normal Ubuntu shell, in the Echo repository:

```bash
cd ~/Documents/echo
bash scripts/setup-voice-ubuntu.sh
```

Review the script first with `nano scripts/setup-voice-ubuntu.sh` if you wish. It installs Ubuntu packages, compiles Whisper.cpp from its official repository, downloads the English `base.en` model, creates an isolated Piper virtual environment, downloads the `en_US-lessac-medium` voice, and creates a WAV file for playback testing. It does not overwrite your private `.env` or personal notes.

If the installation fails under system Python 3.14, inspect the error. Piper's dependencies must support the installed Python version; use a separately installed compatible Python interpreter for its virtual environment rather than replacing Ubuntu's system Python.

## 2. Confirm the speaker and microphone

From the Ubuntu shell:

```bash
aplay ~/Documents/echo-local-tools/test-echo-voice.wav
arecord -l
arecord -q -d 5 -f S16_LE -r 16000 -c 1 /tmp/echo-microphone-test.wav
aplay /tmp/echo-microphone-test.wav
```

If recording fails, check which recording device is selected in Ubuntu's Sound settings. `arecord` uses ALSA, and the default ALSA device may not match the desktop microphone on every system.

## 3. Configure Echo

Edit `~/Documents/echo/.env` and use actual **absolute** file paths. Replace `YOUR_USERNAME` with the username shown by `whoami`, or copy the paths printed at the end of the setup script:

```dotenv
ECHO_WHISPER_BIN=/home/YOUR_USERNAME/Documents/echo-local-tools/whisper.cpp/build/bin/whisper-cli
ECHO_WHISPER_MODEL=/home/YOUR_USERNAME/Documents/echo-local-tools/whisper.cpp/models/ggml-base.en.bin
ECHO_PIPER_MODE=module
ECHO_PIPER_BIN=/home/YOUR_USERNAME/Documents/echo-local-tools/piper-venv/bin/python
ECHO_PIPER_MODEL=/home/YOUR_USERNAME/Documents/echo-local-tools/piper-voices/en_US-lessac-medium.onnx
```

A Piper model is a `.onnx` file with a matching `.onnx.json` file. **Do not use `.bin` for the Piper model.** Whisper uses a `.bin` model, but Piper uses `.onnx`.

You can verify Piper files from Ubuntu:

```bash
ls -lh ~/Documents/echo-local-tools/piper-voices/en_US-lessac-medium.onnx*
```

## 4. Test commands inside Echo

```bash
cd ~/Documents/echo
npm test
npm start
```

At Echo's `you>` prompt, enter one command per line:

```text
/voice check
/voice status
/voice speak Hello Echo
/voice listen 5
/voice ask 5
/voice chat 5
/voice on
What is 43 + 97 in binary?
/voice off
/voice reply
```

- `/voice speak <text>` reads a specific sentence aloud.
- `/voice reply` speaks the most recent substantive response.
- `/voice on` makes Echo speak its replies after displaying them as text, until `/voice off`.
- `answer in voice <question>` speaks only that response without changing voice mode.
- `/voice listen 5` records and transcribes only.
- `/voice ask 5` records, transcribes, and sends a spoken question to Echo, which answers in text unless voice mode is on.
- `/voice chat 5` records, transcribes, answers, and speaks the answer for one turn.
- `listen to me` starts a five-second voice question.

Recordings are temporary local WAV files and are removed after processing. Echo prints recognized words before a spoken action is treated as complete. For safety, voice instructions that would modify tasks or notes require typed confirmation.

`/voice check` checks model and executable paths. It cannot prove that the microphone and speaker devices will work; the playback and recording tests above provide that verification.

## 5. Known limitations

- The `base.en` Whisper model understands English; other languages need different models.
- Speech recognition can mishear names, numbers, and technical terms. Check the printed transcription.
- On an 8 GB CPU-only laptop, recording, transcription, LLM inference, and Piper speech are sequential and may take several seconds.
- Normal chat replies are not automatically spoken until `/voice on` is set for that session.
- Microphone activation is explicit and time-limited. There is no wake word, always-listening service, or speaker identification.
- Echo's models, profile, saved notes and voice recordings stay local during this workflow; installation downloads models and packages from their public sources.

Official references: https://github.com/ggml-org/whisper.cpp and https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md
