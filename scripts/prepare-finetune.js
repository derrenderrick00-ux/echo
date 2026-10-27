#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrainingJournal } from '../src/core/training-journal.js';
const root = fileURLToPath(new URL('..', import.meta.url));
try {
  const journal = await new TrainingJournal({ filePath: resolve(root, 'data/training/approved.json') }).init();
  const result = await journal.exportSplit({ dir: resolve(root, 'data/training/ready') });
  console.log(`Prepared ${result.train} training and ${result.eval} held-out examples.\n${result.trainPath}\n${result.evalPath}\n${result.note}`);
} catch (error) { console.error(`No training export produced: ${error.message}`); process.exitCode = 1; }
