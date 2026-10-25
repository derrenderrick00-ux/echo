#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { phases } from './phases/index.js';
import { createPhase00 } from './phases/phase-00.js';
import { loadLocalEnv, readConfig } from './core/config.js';
import { loadProfile } from './memory/profile.js';
import { OllamaProvider } from './providers/ollama.js';
import { runCli } from './interfaces/cli.js';

export function statusText() {
  return phases.map(({ id, name, status }) => `Phase ${id}: ${name} [${status}]`).join('\n');
}

export async function main() {
  if (process.argv.includes('--status')) {
    console.log(statusText());
    return;
  }
  loadLocalEnv();
  const config = readConfig();
  const profileState = await loadProfile(config.profilePath);
  const provider = new OllamaProvider({ baseUrl: config.baseUrl, model: config.model });
  const session = createPhase00({ provider, profile: profileState.profile, maxTurns: config.maxTurns });
  await runCli({ session, model: config.model, profileState, statusText });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`Startup error: ${error.message}`);
    process.exitCode = 1;
  });
}
