// Ollama's small all-minilm model generates local vector embeddings.
export class OllamaEmbeddings {
  constructor({ baseUrl = 'http://127.0.0.1:11434', model = 'all-minilm',
                fetchImpl = globalThis.fetch, timeoutMs = 90_000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async embed(input) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new Error('Cannot reach the local embeddings service.');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error(`Embedding model missing. Run: ollama pull ${this.model}`);
      throw new Error(`Embedding service returned HTTP ${response.status}.`);
    }
    const data = await response.json();
    const values = data?.embeddings?.[0];
    if (!Array.isArray(values) || !values.length || values.some(v => !Number.isFinite(v))) {
      throw new Error('Embedding service returned an invalid vector.');
    }
    return values;
  }
}
