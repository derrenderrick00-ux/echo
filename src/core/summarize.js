export function summarizeText(input) {
  const text = String(input).trim();
  if (!text) throw new Error('Supply some text to summarize.');
  if (text.length > 16000) throw new Error('Text exceeds the 16,000-character local summary limit.');
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+|$)/g)?.map(v => v.trim()).filter(Boolean) ?? [];
  const summary = sentences.slice(0, 4);
  const actions = sentences.filter(item => /\b(?:must|need to|should|todo|action|plan to|remember to|will)\b/i.test(item)).slice(0, 6);
  return ['Extractive summary (from provided text, not fact-checked):', ...summary.map(x => `- ${x}`), 'Possible action items:', ...(actions.length ? actions.map(x => `- ${x}`) : ['- None explicitly detected.'])].join('\n');
}

export function decisionPrompt(options) {
  const choices = options.split('|').map(x => x.trim()).filter(Boolean);
  if (choices.length < 2 || choices.length > 5) throw new Error('Provide 2–5 options separated by |.');
  if (choices.some(x => x.length > 200)) throw new Error('An option is too long.');
  return 'Compare these user-supplied options. List assumptions, benefits, disadvantages, uncertainties and a conditional recommendation. Do not invent factual details or imply that the recommendation is verified. Options: ' + choices.map((value, i) => `${i + 1}) ${value}`).join('; ');
}
