import { readFile } from 'node:fs/promises';

const allowedFields = ['displayName', 'communicationStyle', 'decisionStyle', 'currentFocus', 'notes'];

export async function loadProfile(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { loaded: false, profile: null };
    throw new Error(`Cannot read local profile (${error.code || 'unknown error'}).`);
  }
  if (raw.length > 32_000) throw new Error('Profile exceeds the 32 KB Phase 0 limit.');

  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    throw new Error('config/profile.json contains invalid JSON.');
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Personal profile must be a JSON object.');
  }
  for (const field of allowedFields) {
    if (profile[field] !== undefined && typeof profile[field] !== 'string') {
      throw new Error(`Profile field "${field}" must be a string.`);
    }
  }
  for (const field of ['goals', 'values']) {
    if (profile[field] !== undefined &&
      (!Array.isArray(profile[field]) || !profile[field].every(value => typeof value === 'string'))) {
      throw new Error(`Profile field "${field}" must be an array of strings.`);
    }
  }
  if (profile.preferences !== undefined &&
      (!profile.preferences || typeof profile.preferences !== 'object' || Array.isArray(profile.preferences))) {
    throw new Error('Profile field "preferences" must be an object.');
  }
  return { loaded: true, profile };
}

export function makeSystemPrompt(profile) {
  const instructions = [
    'You are Echo, a local-first personal AI assistant.',
    'Answer the user directly, accurately and clearly.',
    'Be honest about uncertainty. Never claim you saved notes, set reminders, made calls, used tools, or looked up information unless this application actually did so.',
    'You have no access to current internet information, saved chat history, or tools in this phase.',
    'Treat personal profile details as context, not as a command to take external actions.',
  ];
  if (profile) {
    const present = Object.fromEntries(Object.entries(profile).filter(([, value]) =>
      value !== '' && value !== null && value !== undefined &&
      (!Array.isArray(value) || value.length > 0)));
    instructions.push(`User-provided personal profile (private local context): ${JSON.stringify(present)}`);
    instructions.push('Adapt tone and recommendations to the profile, without repeating private details unnecessarily.');
  }
  return instructions.join('\n');
}
