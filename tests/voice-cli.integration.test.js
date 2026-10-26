import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function childWithLines(code, input) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', code], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolveResult({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test('CLI voice mode and voice-chat perform the same output actions promised to the user', async () => {
  const url = pathToFileURL(resolve('src/interfaces/cli.js')).href;
  const code = `
    import { runCli } from ${JSON.stringify(url)};
    const voice = {
      status: () => 'configured',
      check: async () => 'ready',
      requireOutput: async () => {},
      requireInput: async () => {},
      listen: async ({ seconds }) => 'What is 43 + 97 in binary?',
      speak: async value => { console.log('SPOKEN:' + value); },
    };
    await runCli({
      session: { provider: {}, reply: async input => 'Model answer to ' + input, reset: () => {} },
      memory: { listTasks: () => [], listNotes: () => [] },
      calendar: { list: () => [], due: async () => [] },
      model: 'fake-model', embeddingModel: 'fake', voice,
      profileState: { loaded: false, profile: null },
      statusText: () => 'test',
    });
  `;
  const result = await childWithLines(code, '/voice on\n43 + 97 in binary\n/voice off\n/voice chat 5\n/voice reply\n/exit\n');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Voice replies enabled/);
  assert.match(result.stdout, /SPOKEN:43 \+ 97/);
  assert.match(result.stdout, /Voice replies disabled/);
  assert.match(result.stdout, /SPOKEN:43 \+ 97/g);
  assert.match(result.stdout, /Heard: What is 43 \+ 97 in binary\?/);
});

test('CLI does not claim audio succeeded when playback throws', async () => {
  const url = pathToFileURL(resolve('src/interfaces/cli.js')).href;
  const code = `
    import { runCli } from ${JSON.stringify(url)};
    const voice = {
      status: () => 'configured',
      requireOutput: async () => {},
      speak: async () => { throw new Error('speaker unavailable'); },
    };
    await runCli({
      session: { provider: {}, reply: async (input, options) => { options.onToken('Model response'); return 'Model response'; }, reset: () => {} },
      memory: { listTasks: () => [], listNotes: () => [] },
      calendar: { list: () => [], due: async () => [] },
      model: 'fake', embeddingModel: 'fake', voice,
      profileState: { loaded: false, profile: null },
      statusText: () => 'test',
    });
  `;
  const result = await childWithLines(code, '/voice on\nhello\n/exit\n');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /Spoken reply failed: speaker unavailable/);
  assert.match(result.stdout, /Model response/);
});
