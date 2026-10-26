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
  try { url = new URL(baseUrl); }
  catch { throw new Error('ECHO_OLLAMA_URL must be a valid local HTTP URL.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Phase 0 only supports a local Ollama server at http://127.0.0.1:11434 (or localhost).');
  }
  const model = (env.ECHO_OLLAMA_MODEL || 'llama3.2:1b').trim();
  if (!model || model.length > 100 || /:cloud(?:$|\b)/i.test(model)) throw new Error('Invalid or cloud ECHO_OLLAMA_MODEL value.');
  const embeddingModel = (env.ECHO_EMBED_MODEL || 'all-minilm').trim();
  if (!embeddingModel || embeddingModel.length > 100 || /:cloud(?:$|\b)/i.test(embeddingModel)) {
    throw new Error('Invalid or cloud ECHO_EMBED_MODEL value.');
  }
  if (env.ECHO_MODEL_PROVIDER && env.ECHO_MODEL_PROVIDER !== 'ollama') {
    throw new Error('Phase 0 only supports ECHO_MODEL_PROVIDER=ollama.');
  }
  const maxTurns = Number(env.ECHO_MAX_TURNS ?? 4);
  const maxOutputTokens = Number(env.ECHO_MAX_OUTPUT_TOKENS ?? 768);
  const contextTokens = Number(env.ECHO_CONTEXT_TOKENS ?? 4096);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 30) {
    throw new Error('ECHO_MAX_TURNS must be an integer from 1 to 30.');
  }
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 32 || maxOutputTokens > 2048) {
    throw new Error('ECHO_MAX_OUTPUT_TOKENS must be between 32 and 2048.');
  }
  if (!Number.isInteger(contextTokens) || contextTokens < 1024 || contextTokens > 16384) {
    throw new Error('ECHO_CONTEXT_TOKENS must be between 1024 and 16384.');
  }
  const timeZone = env.ECHO_TIME_ZONE || 'Africa/Nairobi';
  try { new Intl.DateTimeFormat('en-GB', { timeZone }); }
  catch { throw new Error('ECHO_TIME_ZONE must be a supported IANA timezone.'); }
  return {
    timeZone,
    whisperModel: env.ECHO_WHISPER_MODEL || '',
    piperModel: env.ECHO_PIPER_MODEL || '',
    root, baseUrl: url.origin, model, embeddingModel, maxTurns, maxOutputTokens, contextTokens,
    profilePath: resolve(root, 'config/profile.json'),
    memoryPath: resolve(root, 'data/echo-memory.json'),
  };
}
