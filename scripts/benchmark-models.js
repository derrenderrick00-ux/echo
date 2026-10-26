#!/usr/bin/env node
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['llama3.2:1b', 'llama3.2:3b'];
const cases = [
  { label: 'Identity', prompt: 'You are Echo, the AI assistant built by human Derrick. In one sentence, who is Derrick and who is Echo?', expected: 'Must distinguish Derrick (human) from Echo (AI).' },
  { label: 'Binary', prompt: 'Convert decimal 980 to binary. Answer with only the binary digits.', expected: '1111010100' },
  { label: 'Recall', prompt: "User: I'm learning Express.js.\nUser: Which web framework did I just mention?\nAssistant:", expected: 'Express.js' },
];
if (models.some(name => !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,99}$/.test(name) || name.includes('..') || /:cloud(?:$|\b)/i.test(name))) {
  console.error('Invalid or cloud model name. Only locally downloaded Ollama models are allowed.');
  process.exit(1);
}
const url = 'http://127.0.0.1:11434/api/chat';
for (const model of models) {
  console.log(`\n===== ${model} =====`);
  for (const item of cases) {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, stream: false, keep_alive: '2m',
          messages: [{ role: 'user', content: item.prompt }],
          options: { num_predict: 128, num_ctx: 2048, temperature: 0 },
        }),
        signal: AbortSignal.timeout(360_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}; did you run ollama pull ${model}?`);
      const data = await response.json();
      const seconds = (performance.now() - start) / 1000;
      const rate = data.eval_count && data.eval_duration ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(1) : 'n/a';
      const answer = String(data?.message?.content ?? '').trim();
      console.log(`${item.label}: ${seconds.toFixed(1)}s wall time; ${rate} generated tokens/s`);
      console.log(`  Expected: ${item.expected}`);
      console.log(`  Actual: ${answer.slice(0, 360).replace(/\s+/g, ' ') || '(no text)'}`);
    } catch (error) {
      console.error(`${item.label}: ${error.message}`);
    }
  }
  try {
    await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 }), signal: AbortSignal.timeout(30_000),
    });
  } catch {  }
}
console.log('\nUse accuracy, responsiveness, and memory usage together; this is a small smoke benchmark, not a scientific evaluation.');
