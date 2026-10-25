import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadLocalEnv(root = process.cwd()) {
  const envFile = resolve(root, '.env');
  if (existsSync(envFile)) loadEnvFile(envFile);
}

export function readConfig({ root = process.cwd(), env = process.env } = {}) {
  const baseUrl = env.ECHO_OLLAMA_URL || 'http://127.0.0.1:11434';
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('ECHO_OLLAMA_URL must be a valid local HTTP URL.');
  }

  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Phase 0 only supports a local Ollama server at http://127.0.0.1:11434 (or localhost).');
  }
  const model = (env.ECHO_OLLAMA_MODEL || 'llama3.2:1b').trim();
  if (!model || model.length > 100) throw new Error('Invalid ECHO_OLLAMA_MODEL value.');
  if (env.ECHO_MODEL_PROVIDER && env.ECHO_MODEL_PROVIDER !== 'ollama') {
    throw new Error('Phase 0 only supports ECHO_MODEL_PROVIDER=ollama.');
  }
  const maxTurns = Number(env.ECHO_MAX_TURNS ?? 8);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 30) {
    throw new Error('ECHO_MAX_TURNS must be an integer from 1 to 30.');
  }

  return {
    root,
    baseUrl: url.origin,
    model,
    maxTurns,
    profilePath: resolve(root, 'config/profile.json'),
  };
}
