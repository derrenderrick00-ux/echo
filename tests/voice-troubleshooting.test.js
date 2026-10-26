import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AssistantController } from '../src/core/assistant.js';

function controllerFor(voice) {
  return new AssistantController({
    session: { provider: {}, reply: async () => 'Hello there.', reset() {} },
    memory: { listNotes: () => [], listTasks: () => [] },
    calendar: { list: () => [] },
    profileState: { loaded: true, profile: { displayName: 'User' } },
    model: 'test', embeddingModel: 'test', voice,
  });
}

function childInput(script, lines) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI test timed out')); }, 4000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolveResult({ stdout, stderr, code }); });
    child.stdin.end(lines);
  });
}

const cliUrl = pathToFileURL(resolve('src/interfaces/cli.js')).href;

test('voice mode requests an audible acknowledgment after preflight', async () => {
  const c = controllerFor({ requireOutput: async () => {} });
  const result = await c.answer('/voice on');
  assert.equal(result.speak, true);
  assert.equal(result.activationSpeech, true);
  assert.match(result.text, /enabled/);
});

test('voice test calls actual speech adapter rather than checking paths only', async () => {
  let speech = '';
  const c = controllerFor({ speak: async value => { speech = value; } });
  const result = await c.answer('/voice test');
  assert.match(speech, /If you can hear this message/);
  assert.match(result.text, /If no sound was audible/);
});

test('voice activation playback failure is shown and mode does not stay enabled', async () => {
  const script = `
    import { runCli } from ${JSON.stringify(cliUrl)};
    await runCli({
      session: { provider: {}, reply: async () => 'Hi', reset() {} },
      memory: { listNotes: () => [], listTasks: () => [] },
      calendar: { list: () => [], due: async () => [] },
      model: 'test', embeddingModel: 'test',
      profileState: { loaded: true, profile: { displayName: 'User' } },
      voice: { requireOutput: async () => {}, speak: async () => { throw new Error('playback failed'); }, status: () => 'configured' },
      statusText: () => 'test',
    });
  `;
  const result = await childInput(script, '/voice on\n/voice status\n/exit\n');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /Voice mode was not enabled/);
  assert.match(result.stdout, /Spoken replies this session: OFF/);
});

test('when Ollama fails in voice mode Echo attempts a spoken diagnostic', async () => {
  const script = `
    import { runCli } from ${JSON.stringify(cliUrl)};
    await runCli({
      session: { provider: {}, reply: async () => { throw new Error('Ollama timed out. CPU-only inference may be slow.'); }, reset() {} },
      memory: { listNotes: () => [], listTasks: () => [] },
      calendar: { list: () => [], due: async () => [] },
      model: 'test', embeddingModel: 'test',
      profileState: { loaded: true, profile: { displayName: 'User' } },
      voice: { requireOutput: async () => {}, speak: async value => console.log('SPOKEN:' + value), status: () => 'configured' },
      statusText: () => 'test',
    });
  `;
  const result = await childInput(script, '/voice on\nhello\n/exit\n');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /Ollama timed out/);
  assert.match(result.stdout, /SPOKEN:The local language model did not respond/);
});
