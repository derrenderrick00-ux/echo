export class OllamaProvider {
  constructor({ baseUrl = 'http://127.0.0.1:11434', model = 'llama3.2:1b',
                fetchImpl = globalThis.fetch, timeoutMs = 180_000, numCtx = 2048,
                maxOutputTokens = 192 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.numCtx = numCtx;
    this.maxOutputTokens = maxOutputTokens;
    this.lastTruncated = false;
  }

  async chat(messages, { onToken } = {}) {
    if (!Array.isArray(messages) || !messages.length) {
      throw new Error('Cannot query Ollama without messages.');
    }
    this.lastTruncated = false;
    const streaming = typeof onToken === 'function';
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model, messages, stream: streaming, keep_alive: '3m',
          options: { num_ctx: this.numCtx, num_predict: this.maxOutputTokens },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error('Ollama timed out. CPU-only inference may be slow.');
      }
      throw new Error('Cannot reach local Ollama. Run: systemctl status ollama');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error(`Model "${this.model}" is unavailable. Run: ollama pull ${this.model}`);
      throw new Error(`Ollama returned HTTP ${response.status}. Check: journalctl -u ollama -n 30`);
    }

    if (streaming) return this.#readStream(response, onToken);
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Ollama returned invalid JSON.'); }
    this.lastTruncated = data?.done_reason === 'length';
    const answer = data?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('Ollama returned an empty response.');
    return answer.trim();
  }

  async #readStream(response, onToken) {
    if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
      throw new Error('Ollama streaming response was not readable.');
    }
    const decoder = new TextDecoder();
    let buffer = '', answer = '', completed = false;
    const parseLine = raw => {
      if (!raw.trim()) return;
      let item;
      try { item = JSON.parse(raw); } catch { throw new Error('Ollama returned a malformed stream.'); }
      if (item.error) throw new Error(`Ollama: ${item.error}`);
      const token = item.message?.content;
      if (typeof token === 'string' && token) { answer += token; onToken(token); }
      if (item.done === true) { completed = true; this.lastTruncated = item.done_reason === 'length'; }
    };
    try {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          parseLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) parseLine(buffer);
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error('Ollama stream timed out. Any visible partial answer may be incomplete and was not saved. Try /diagnostics and request a shorter response.');
      }
      throw error;
    }
    if (!completed) throw new Error('Ollama stream ended prematurely; response was not stored in history.');
    if (!answer.trim()) throw new Error('Ollama returned an empty response.');
    return answer.trim();
  }
}
