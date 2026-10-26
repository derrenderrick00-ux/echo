import { readFile } from 'node:fs/promises';
import { freemem, totalmem } from 'node:os';

const gib = bytes => (bytes / 1024 ** 3).toFixed(2) + ' GiB';

export function parseMemoryInfo(raw) {
  const values = Object.fromEntries([...String(raw).matchAll(/^(MemTotal|MemAvailable|SwapTotal|SwapFree):\s+(\d+)\s+kB/gm)].map(match => [match[1], Number(match[2]) * 1024]));
  if (!values.MemTotal || values.MemAvailable === undefined) throw new Error('Cannot parse Linux memory report.');
  return values;
}

export async function resourceSummary({ linuxMeminfo = '/proc/meminfo', read = readFile } = {}) {
  let data;
  try { data = parseMemoryInfo(await read(linuxMeminfo, 'utf8')); }
  catch { data = { MemTotal: totalmem(), MemAvailable: freemem() }; }
  const available = data.MemAvailable;
  const lines = [
    `Usable RAM: ${gib(data.MemTotal)}; available RAM: ${gib(available)}.`,
  ];
  if (data.SwapTotal !== undefined && data.SwapFree !== undefined) lines.push(`Swap used: ${gib(data.SwapTotal - data.SwapFree)} of ${gib(data.SwapTotal)}.`);
  if (available < 1024 ** 3) lines.push('WARNING: less than 1 GiB available. Close heavy applications and unload unused models before starting CPU inference.');
  else if (available < 2 * 1024 ** 3) lines.push('CAUTION: less than 2 GiB available. Large prompts or 3B inference may cause swapping.');
  else lines.push('Memory headroom is better, but monitor CPU, temperature and Ollama RAM use during inference.');
  lines.push('This is a current host-memory snapshot, not a guaranteed Ollama memory forecast.');
  return lines.join('\n');
}
