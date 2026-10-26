import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(binary, args, { stdinText = null, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(new Error(`Cannot execute ${binary}: ${error.message}`)); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${binary} failed: ${(stderr || stdout).trim().slice(0, 500) || `exit ${code}`}`));
      else resolve(stdout);
    });
    child.stdin.end(stdinText ?? '');
  });
}

export class LocalVoice {
  constructor({ whisperBin = 'whisper-cli', whisperModel = '', piperBin = 'piper', piperModel = '', recorder = 'arecord', player = 'aplay', runImpl = run } = {}) {
    this.whisperBin = whisperBin;
    this.whisperModel = whisperModel;
    this.piperBin = piperBin;
    this.piperModel = piperModel;
    this.recorder = recorder;
    this.player = player;
    this.run = runImpl;
  }
  status() {
    return `Optional local voice: Whisper model ${this.whisperModel ? 'configured' : 'NOT configured'}; Piper model ${this.piperModel ? 'configured' : 'NOT configured'}. Microphone and speaker must be tested on-device.`;
  }
  async transcribe(file) {
    if (!this.whisperModel) throw new Error('Whisper model not configured. Set ECHO_WHISPER_MODEL to a local ggml model path.');
    await access(this.whisperModel);
    await access(file);
    const stdout = await this.run(this.whisperBin, ['-m', this.whisperModel, '-f', file, '-nt', '-np']);
    const transcript = stdout.replace(/\[[\d:.\s>-]+\]/g, '').trim();
    if (!transcript) throw new Error('Whisper produced no transcription.');
    return transcript;
  }
  async listen({ seconds = 5 } = {}) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) throw new Error('Recording duration must be 1–30 seconds.');
    if (!this.whisperModel) throw new Error('Whisper model not configured. Set ECHO_WHISPER_MODEL.');
    await access(this.whisperModel);
    const folder = await mkdtemp(join(tmpdir(), 'echo-voice-'));
    try {
      const file = join(folder, 'recording.wav');
      await this.run(this.recorder, ['-q', '-d', String(seconds), '-f', 'S16_LE', '-r', '16000', '-c', '1', file]);
      return await this.transcribe(file);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  async speak(text) {
    if (!this.piperModel) throw new Error('Piper model not configured. Set ECHO_PIPER_MODEL to a local .onnx model path.');
    await access(this.piperModel);
    const clean = String(text).trim();
    if (!clean) throw new Error('Cannot speak an empty message.');
    const folder = await mkdtemp(join(tmpdir(), 'echo-speech-'));
    try {
      const file = join(folder, 'speech.wav');
      await this.run(this.piperBin, ['--model', this.piperModel, '--output_file', file], { stdinText: clean });
      await access(file);
      await this.run(this.player, ['-q', file]);
      return true;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
