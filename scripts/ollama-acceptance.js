#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const model = (process.env.ECHO_OLLAMA_MODEL || 'llama3.2:1b').trim();
if (!/^[a-zA-Z0-9][\w./:-]{0,99}$/.test(model) || /:cloud(?:$|\b)/i.test(model) || model.includes('..')) {
  console.error('Invalid or cloud model name. Local Ollama only.'); process.exit(1);
}
const prompts = [
  { id: 'identity', text: 'You are Echo, an AI assistant. The human developer is Derrick. Answer ONLY in this format: Human: Derrick; Assistant: Echo.', score: s => /human\s*:\s*derrick/i.test(s) && /assistant\s*:\s*echo/i.test(s) },
  { id: 'modulo', text: 'In C, what does the percent symbol mean in rand() % 100? Reply with ONE sentence.', score: s => /remainder|modulo|modulus/i.test(s) },
  { id: 'planck', text: 'What is Planck constant h in SI units? Give the value and units in one line.', score: s => /6[.,]6260?7015/i.test(s) && /(10\s*\^\s*-?34|10[⁻−-]³⁴|e-34|10\*\*-34)/i.test(s) },
];
const measurements = [];
for (const item of prompts) {
  const start = performance.now();
  let row;
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, keep_alive: '2m', messages: [{ role: 'user', content: item.text }], options: { num_predict: 160, num_ctx: 2048, temperature: 0 } }),
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reply = await response.json();
    const answer = String(reply?.message?.content || '').trim();
    row = { id: item.id, elapsedMs: Math.round(performance.now() - start), scoredPass: Boolean(item.score(answer)), error: null, answer: answer.slice(0, 400),
      promptEvalTokens: reply.prompt_eval_count ?? null, outputTokens: reply.eval_count ?? null, evalDurationNs: reply.eval_duration ?? null };
  } catch (error) { row = { id: item.id, elapsedMs: Math.round(performance.now() - start), scoredPass: false, error: error.message, answer: '' }; }
  measurements.push(row);
  console.log(`${row.id}: ${row.scoredPass ? 'heuristic PASS' : 'FAIL/UNVERIFIED'} in ${row.elapsedMs}ms${row.error ? ' — ' + row.error : ''}`);
}
try { await fetch('http://127.0.0.1:11434/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model,keep_alive:0}), signal:AbortSignal.timeout(10000) }); } catch {}
const latencies=measurements.map(x=>x.elapsedMs).sort((a,b)=>a-b);
const report={ version:1,at:new Date().toISOString(),model,rounds:measurements,heuristicPassed:measurements.filter(x=>x.scoredPass).length,
  total:measurements.length,p95Ms:latencies[Math.ceil(latencies.length*.95)-1],
  caveat:'Three prompts and regex checks are smoke metrics, NOT scientific accuracy, general model reliability or a trained-adapter comparison.' };
await mkdir(join(root,'data'),{recursive:true,mode:0o700});
const out=join(root,'data','echo-ollama-acceptance.json');
await writeFile(out,JSON.stringify(report,null,2),{mode:0o600}); await chmod(out,0o600);
console.log(`Recorded local-model test: ${report.heuristicPassed}/${report.total} heuristic passes; p95 ${report.p95Ms}ms. Results in data/echo-ollama-acceptance.json`);
if (report.heuristicPassed !== report.total) process.exitCode=1;
