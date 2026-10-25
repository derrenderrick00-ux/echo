// Only local Ollama inference is supported in Phase 0.
export class OllamaProvider {
  constructor({ baseUrl = 'http://127.0.0.1:11434', model = 'llama3.2:1b',
                fetchImpl = globalThis.fetch, timeoutMs = 180_000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async chat(messages) {
    if (!Array.isArray(messages) || !messages.length) {
      throw new Error('Cannot query Ollama without messages.');
    }
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error('Ollama timed out. A CPU-only model can be slow on its first response.');
      }
      throw new Error('Cannot reach local Ollama. Run: systemctl status ollama');
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Model "${this.model}" is unavailable. Run: ollama pull ${this.model}`);
      }
      throw new Error(`Ollama returned HTTP ${response.status}. Check: journalctl -u ollama -n 30`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Ollama returned invalid JSON.');
    }
    const text = data?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Ollama returned an empty response.');
    }
    return text.trim();
  }
}
