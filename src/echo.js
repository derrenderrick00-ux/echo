#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { phases } from './phases/index.js';
import { createPhase00 } from './phases/phase-00.js';
import { loadLocalEnv, readConfig } from './core/config.js';
import { loadProfile } from './memory/profile.js';
import { MemoryStore } from './memory/store.js';
import { LocalCalendar } from './core/calendar.js';
import { LocalVoice } from './providers/voice.js';
import { OllamaProvider } from './providers/ollama.js';
import { OllamaEmbeddings } from './providers/embeddings.js';
import { runCli } from './interfaces/cli.js';
import { Phase2Workspace } from './core/phase2-workspace.js';
import { CodeSandbox } from './tools/sandbox.js';
import { ActionJournal } from './core/action-journal.js';
import { ManualSync } from './core/phase3-sync.js';

export function statusText() {
  return phases.map(({ id, name, status }) => `Phase ${id}: ${name} [${status}]`).join('\n');
}

export async function main() {
  if (process.argv.includes('--status')) { console.log(statusText()); return; }
  loadLocalEnv();
  const config = readConfig();
  const profileState = await loadProfile(config.profilePath);
  const provider = new OllamaProvider({ baseUrl: config.baseUrl, model: config.model, numCtx: config.contextTokens, maxOutputTokens: config.maxOutputTokens, timeoutMs: config.timeoutMs });
  const embedder = new OllamaEmbeddings({ baseUrl: config.baseUrl, model: config.embeddingModel });
  const memory = await new MemoryStore({ filePath: config.memoryPath, embedder }).init();
  const calendar = await new LocalCalendar({ filePath: resolve(config.root, 'data/echo-calendar.json') }).init();
  const voice = new LocalVoice({ whisperModel: config.whisperModel, whisperBin: config.whisperBin, piperModel: config.piperModel, piperBin: config.piperBin, piperMode: config.piperMode });
  const phase2Workspace = await new Phase2Workspace({ filePath: resolve(config.root, 'data/echo-phase2.json') }).init();
  const actionJournal = await new ActionJournal({ filePath: resolve(config.root, 'data/echo-actions.json') }).init();
  const manualSync = await new ManualSync({ directory: resolve(config.root, 'data/sync'), memory }).init();
  const codeSandbox = await new CodeSandbox({ workspaceDir: resolve(config.root, 'data/code-workspace'), enabled: process.env.ECHO_EXPERIMENTAL_CODE_EXECUTION === '1' }).init();
  const session = createPhase00({ provider, profile: profileState.profile, memory, maxTurns: config.maxTurns });
  session.contextProvider = () => phase2Workspace.promptContext();
  await runCli({ session, memory, calendar, model: config.model, embeddingModel: config.embeddingModel, profileState, statusText, voice, phase2Workspace, codeSandbox, actionJournal, manualSync, timeZone: config.timeZone });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Startup error: ${error.message}`); process.exitCode = 1; });
}
