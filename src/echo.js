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
import { DailyReview } from './core/daily-review.js';
import { FileWorkspace } from './core/file-workspace.js';
import { LearningJournal } from './core/learning-journal.js';
import { PrivateContext } from './core/private-context.js';
import { ProgressInterview } from './core/progress-interview.js';
import { BackgroundAgent } from './core/background-agent.js';
import { TrainingJournal } from './core/training-journal.js';

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
  const dailyReview = await new DailyReview({ filePath: resolve(config.root, 'data/echo-devlog.json'), reportPath: resolve(config.root, 'data/echo-test-report.json'), qualityPath: resolve(config.root, 'data/echo-quality.json'), timeZone: config.timeZone }).init();
  const codeSandbox = await new CodeSandbox({ workspaceDir: resolve(config.root, 'data/code-workspace'), enabled: process.env.ECHO_EXPERIMENTAL_CODE_EXECUTION === '1' }).init();
  const fileWorkspace = await new FileWorkspace({ root: resolve(config.root, 'data/code-workspace') }).init();
  const learningJournal = await new LearningJournal({ filePath: resolve(config.root, 'data/echo-learning.json') }).init();
  const privateContext = await new PrivateContext({ filePath: resolve(config.root, 'data/echo-context.json'), seedPath: resolve(config.root, 'data/echo-context-seed.json') }).init();
  const progressInterview = await new ProgressInterview({ secretPath: resolve(config.root, 'data/echo-interview-key.json'), context: privateContext }).init();
  const backgroundAgent = await new BackgroundAgent({ filePath: resolve(config.root, 'data/echo-background.json'), inboxDir: resolve(config.root, 'data/background-inbox'), timeZone: config.timeZone, memory, calendar, dailyReview }).init();
  const trainingJournal = await new TrainingJournal({ filePath: resolve(config.root, 'data/training/approved.json') }).init();
  const session = createPhase00({ provider, profile: profileState.profile, memory, maxTurns: config.maxTurns });
  session.learningJournal = learningJournal;
  session.contextProvider = query => [phase2Workspace.promptContext(), privateContext.relevant(query)].filter(Boolean).join('\n');
  await runCli({ session, memory, calendar, model: config.model, embeddingModel: config.embeddingModel, profileState, statusText, voice, phase2Workspace, codeSandbox, actionJournal, manualSync, dailyReview, fileWorkspace, learningJournal, privateContext, progressInterview, backgroundAgent, trainingJournal, timeZone: config.timeZone });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Startup error: ${error.message}`); process.exitCode = 1; });
}
