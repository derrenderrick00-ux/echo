#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackgroundAgent } from '../src/core/background-agent.js';
import { MemoryStore } from '../src/memory/store.js';
import { LocalCalendar } from '../src/core/calendar.js';
import { DailyReview } from '../src/core/daily-review.js';
import { resourceSummary } from '../src/core/resources.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const data = resolve(root, 'data');
const timeZone = 'Africa/Nairobi';
async function main() {
  const memory = await new MemoryStore({ filePath: resolve(data, 'echo-memory.json') }).init();
  const calendar = await new LocalCalendar({ filePath: resolve(data, 'echo-calendar.json') }).init();
  const dailyReview = await new DailyReview({ filePath: resolve(data, 'echo-devlog.json'), reportPath: resolve(data, 'echo-test-report.json'), qualityPath: resolve(data, 'echo-quality.json'), timeZone }).init();
  const agent = await new BackgroundAgent({ filePath: resolve(data, 'echo-background.json'), inboxDir: resolve(data, 'background-inbox'), memory, calendar, dailyReview, resources: resourceSummary, timeZone }).init();
  const result = await agent.runDue();
  console.log(result.length ? result.map(x => `[${x.id}] ${x.status}${x.error ? ': ' + x.error : ''}`).join('\n') : 'No approved background jobs due.');
  if (result.some(x => x.status === 'failed')) process.exitCode = 1;
}
main().catch(error => { console.error(`Background tick failed: ${error.message}`); process.exitCode = 1; });
