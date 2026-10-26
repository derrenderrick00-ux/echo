#!/usr/bin/env bash
set -euo pipefail

TOOLS_DIR="${HOME}/Documents/echo-local-tools"
WHISPER_DIR="${TOOLS_DIR}/whisper.cpp"
PIPER_VENV="${TOOLS_DIR}/piper-venv"
VOICE_DIR="${TOOLS_DIR}/piper-voices"

sudo apt update
sudo apt install -y git cmake build-essential alsa-utils python3-venv
mkdir -p "$TOOLS_DIR" "$VOICE_DIR"

if [[ ! -d "$WHISPER_DIR/.git" ]]; then
  git clone https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
fi

if [[ ! -s "$WHISPER_DIR/models/ggml-base.en.bin" ]]; then
  (cd "$WHISPER_DIR" && sh ./models/download-ggml-model.sh base.en)
fi

cmake -S "$WHISPER_DIR" -B "$WHISPER_DIR/build"
cmake --build "$WHISPER_DIR/build" -j2 --config Release

if [[ ! -x "$PIPER_VENV/bin/python" ]]; then
  python3 -m venv "$PIPER_VENV"
fi

"$PIPER_VENV/bin/python" -m pip install --upgrade pip
"$PIPER_VENV/bin/python" -m pip install piper-tts

if [[ ! -s "$VOICE_DIR/en_US-lessac-medium.onnx" || ! -s "$VOICE_DIR/en_US-lessac-medium.onnx.json" ]]; then
  (cd "$VOICE_DIR" && "$PIPER_VENV/bin/python" -m piper.download_voices en_US-lessac-medium)
fi

"$PIPER_VENV/bin/python" -m piper -m "$VOICE_DIR/en_US-lessac-medium.onnx" -f "$TOOLS_DIR/test-echo-voice.wav" -- 'Hello from Echo.'

printf '\nSetup files are ready. Play the test audio with:\n  aplay "%s"\n' "$TOOLS_DIR/test-echo-voice.wav"
printf '\nAdd or correct these lines in ~/Documents/echo/.env:\n'
printf 'ECHO_WHISPER_BIN=%s/build/bin/whisper-cli\n' "$WHISPER_DIR"
printf 'ECHO_WHISPER_MODEL=%s/models/ggml-base.en.bin\n' "$WHISPER_DIR"
printf 'ECHO_PIPER_MODE=module\n'
printf 'ECHO_PIPER_BIN=%s/bin/python\n' "$PIPER_VENV"
printf 'ECHO_PIPER_MODEL=%s/en_US-lessac-medium.onnx\n' "$VOICE_DIR"
printf '\nRestart Echo, run /voice check, /voice speak Hello Echo, and /voice chat 5.\n'
