export function timeoutExplanation({ timeoutMs = 180000 } = {}) {
  const seconds = Math.round(timeoutMs / 1000);
  return `"Ollama stream timed out" means Echo stopped waiting for a response from the local model after its timeout limit (currently ${seconds} seconds). This can happen during long answers on CPU-only hardware. If partial output appeared, it may be incomplete and was not saved as a completed conversation turn. This is a local runtime error, not an internet or knowledge issue. Shorten the request or ask for one section at a time; check ollama ps and free -h; if needed increase ECHO_OLLAMA_TIMEOUT_MS in .env and restart Echo. Raising the limit allows more time but does not make the model more accurate.`;
}

export function voiceSetup({ status = '' } = {}) {
  return [
    'Echo can speak on request and accept a spoken question once local voice tools are installed.',
    status,
    'Use /voice check to verify model files, /voice speak Hello Echo to test playback, and /voice listen 5 to test transcription only.',
    'Use /voice ask 5 to speak one question and receive text, or /voice chat 5 to speak one question and hear the response.',
    'Use /voice on to speak every reply after typing, /voice off to stop, /voice reply to read the previous response, or say "answer in voice <question>" for one spoken response.',
    'For Ubuntu installation, open docs/VOICE_SETUP_UBUNTU.md in your editor and run only the shell commands in your terminal.',
    'Voice input cannot silently execute commands that change saved data. Confirm those by typing them.',
    'Do not reinstall Node.js or use npm install espeak; those instructions are unrelated to Echo voice.',
  ].join('\n');
}

export function voiceRequested(status = '') {
  return `Voice is available after local setup: ${status}. Use /voice on to enable spoken replies or /voice chat 5 to speak one question.`;
}

export function javascriptDateExplanation(dateText) {
  return `JavaScript uses new Date() or Date() (capital D), not date(). Echo already gets its clock from Node.js. Device date and time: ${dateText}`;
}
