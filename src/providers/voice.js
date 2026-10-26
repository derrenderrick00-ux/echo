import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

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
  constructor({ whisperBin = 'whisper-cli', whisperModel = '', piperBin = 'piper', piperModel = '', piperMode = 'legacy', recorder = 'arecord', player = 'aplay', runImpl = run } = {}) {
    this.whisperBin = whisperBin;
    this.whisperModel = whisperModel;
    this.piperBin = piperBin;
    this.piperModel = piperModel;
    this.piperMode = piperMode;
    this.recorder = recorder;
    this.player = player;
    this.run = runImpl;
  }
  status() {
    return `Optional local voice: Whisper model path ${this.whisperModel ? 'provided' : 'NOT configured'}; Piper model path ${this.piperModel ? 'provided' : 'NOT configured'}. Model paths alone do not prove the binaries, microphone, or speakers work. Session-controlled spoken replies require /voice on; use /voice check and a playback test to verify setup.`;
  }
  async requireExecutable(binary, label) {
    if (binary.includes('/')) {
      try { await access(binary, constants.X_OK); }
      catch { throw new Error(`${label} executable is missing or not executable: ${binary}`); }
      return;
    }
    if (this.run !== run) return;
    for (const folder of (process.env.PATH || '').split(delimiter)) {
      if (!folder) continue;
      try { await access(join(folder, binary), constants.X_OK); return; }
      catch {}
    }
    throw new Error(`${label} executable "${binary}" was not found in PATH. Complete docs/VOICE_SETUP_UBUNTU.md.`);
  }
  async requireInput() {
    if (!this.whisperModel) throw new Error('Whisper model is not configured. Set ECHO_WHISPER_MODEL and read docs/VOICE_SETUP_UBUNTU.md.');
    try { await access(this.whisperModel); }
    catch { throw new Error(`Whisper model file is missing: ${this.whisperModel}`); }
    await this.requireExecutable(this.whisperBin, 'Whisper');
    await this.requireExecutable(this.recorder, 'Audio recorder');
  }
  async requireOutput() {
    if (!this.piperModel) throw new Error('Piper model is not configured. Set ECHO_PIPER_MODEL and read docs/VOICE_SETUP_UBUNTU.md.');
    if (!this.piperModel.endsWith('.onnx')) throw new Error(`Piper needs an .onnx voice model, not ${this.piperModel}. Update ECHO_PIPER_MODEL.`);
    try { await access(this.piperModel); }
    catch { throw new Error(`Piper voice model file is missing: ${this.piperModel}`); }
    try { await access(`${this.piperModel}.json`); }
    catch { throw new Error(`Piper voice configuration file is missing: ${this.piperModel}.json`); }
    if (!['legacy', 'module'].includes(this.piperMode)) throw new Error('ECHO_PIPER_MODE must be legacy or module.');
    await this.requireExecutable(this.piperBin, 'Piper');
    await this.requireExecutable(this.player, 'Audio player');
  }
  async check() {
    const items = [];
    for (const [label, check] of [['Whisper input', () => this.requireInput()], ['Piper output', () => this.requireOutput()]]) {
      try { await check(); items.push(`${label}: local files found; device operation not yet verified.`); }
      catch (error) { items.push(`${label}: ${error.message}`); }
    }
    return items.join('\n');
  }
  async transcribe(file) {
    await this.requireInput();
    await access(file);
    const stdout = await this.run(this.whisperBin, ['-m', this.whisperModel, '-f', file, '-nt', '-np']);
    const transcript = stdout.replace(/\[[\d:.\s>-]+\]/g, '').trim();
    if (!transcript) throw new Error('Whisper produced no transcription.');
    return transcript;
  }
  async listen({ seconds = 5 } = {}) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) throw new Error('Recording duration must be 1–30 seconds.');
    await this.requireInput();
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
    await this.requireOutput();
    const clean = String(text).trim();
    if (!clean) throw new Error('Cannot speak an empty message.');
    const folder = await mkdtemp(join(tmpdir(), 'echo-speech-'));
    try {
      const file = join(folder, 'speech.wav');
      if (this.piperMode === 'module') {
        await this.run(this.piperBin, ['-m', 'piper', '-m', this.piperModel, '-f', file, '--', clean]);
      } else if (this.piperMode === 'legacy') {
        await this.run(this.piperBin, ['--model', this.piperModel, '--output_file', file], { stdinText: clean });
      } else {
        throw new Error('ECHO_PIPER_MODE must be legacy or module.');
      }
      await access(file);
      await this.run(this.player, ['-q', file]);
      return true;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
