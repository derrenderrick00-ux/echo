#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { phases } from './phases/index.js';
import { phase00Help } from './phases/phase-00.js';

export function statusText() {
  return phases.map(({ id, name, status }) => `Phase ${id}: ${name} [${status}]`).join('\n');
}

async function main() {
  if (process.argv.includes('--status')) {
    console.log(statusText());
    return;
  }
  console.log('Echo v0.0.1 — Phase 0 CLI scaffold (AI not connected)');
  console.log(phase00Help());
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY) });
  try {
    while (true) {
      const message = (await rl.question('you> ')).trim();
      if (message === '/exit' || message === '/quit') break;
      if (message === '/help') console.log(phase00Help());
      else if (message === '/status') console.log(statusText());
      else if (message) console.log('echo> Local AI conversation is not implemented yet. See docs/phases/phase-00.md.');
    }
  } catch (error) {
    if (error?.code !== 'ERR_USE_AFTER_CLOSE' && error?.code !== 'ERR_INVALID_STATE') throw error;
  } finally {
    rl.close();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    console.error(`Startup error: ${error.message}`);
    process.exitCode = 1;
  });
}
