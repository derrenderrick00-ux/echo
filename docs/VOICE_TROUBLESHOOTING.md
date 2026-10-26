# Echo v0.1.0-rc.4 — Voice and Ollama troubleshooting

## Verification order

First verify Piper independently from Ollama. The voice setup script created a local test file. In a normal Ubuntu terminal:

```bash
aplay "$HOME/Documents/echo-local-tools/test-echo-voice.wav"
```

Then start Echo with `npm start` and, at its `you>` prompt, try:

```text
/voice check
/voice test
/voice on
43 + 97 in binary
/voice reply
/voice chat 5
/voice off
```

`/voice test` and the arithmetic response do not need Ollama inference. They help distinguish audio playback from model latency. The enable command now requests audible confirmation, and the CLI prints when it starts speaking. Neither a successful process exit nor `/voice check` proves that a person heard sound.

## If sound is silent

Check your Ubuntu output device, output volume, muted state, and the speaker/headphone selection. Try `wpctl status` if PipeWire tools are installed. `aplay` prints a playback status even if the sink is muted. Try headphone output as a comparison. Do not assume that voice synthesis or playback is faulty until the standalone WAV is audible.

## If microphone transcription fails

In a normal terminal:

```bash
arecord -q -d 5 -f S16_LE -r 16000 -c 1 /tmp/echo-microphone-test.wav
aplay /tmp/echo-microphone-test.wav
"$HOME/Documents/echo-local-tools/whisper.cpp/build/bin/whisper-cli" -m "$HOME/Documents/echo-local-tools/whisper.cpp/models/ggml-base.en.bin" -f /tmp/echo-microphone-test.wav -nt
```

Check that speech is audible in the recording and that the transcript matches what you said. The five-second microphone recording is only taken when explicitly commanded.

## If Ollama times out

Exit Echo. Run these in the Ubuntu terminal:

```bash
ollama ps
free -h
systemctl is-active ollama
ollama run llama3.2:3b 'Reply with exactly: hello'
```

For another local-only test, try the smaller model:

```bash
ollama run llama3.2:1b 'Reply with exactly: hello'
```

A large difference in time between these models can indicate a resource or model-load bottleneck. If either model stalls, inspect Ollama logs:

```bash
journalctl -u ollama -n 50 --no-pager
```

Check the actual timeout and context in Echo using `/diagnostics`. Increasing the timeout can accommodate slower inference, but does not fix memory exhaustion. On an 8 GB CPU-only laptop, consider reducing the context and output-token limits for a controlled experiment.

## Interpretation

A `/voice on` confirmation only verifies that Echo attempted playback and the playback command completed. If a person cannot hear it, check the Ubuntu audio route. Spoken answers require a completed answer from the deterministic functions or the LLM. If Ollama stalls, Echo will attempt to speak a failure notice without calling the LLM again. Voice is still session-operated, not always listening, and automatic speech recognition only occurs through explicit commands such as `/voice chat 5`.
