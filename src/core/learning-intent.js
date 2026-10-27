export function parseLearningIntent(raw) {
  const text = String(raw).trim().replace(/^(?:hey[, ]+)?echo[,!: ]+/i, '');
  if (!text || text.startsWith('/')) return null;
  if (/^(?:what (?:have|did) you learn|what do you (?:know|remember) from (?:my )?corrections|show (?:me )?what you learned)\??$/i.test(text)) return { type: 'learnList' };
  let match = text.match(/^(?:what (?:did|have) you learn about|what have i taught you about|show (?:me )?what you learned about)\s+(.+?)\??$/i);
  if (match) return { type: 'learnFind', topic: match[1].trim() };
  if (/^(?:that(?:'s| is) (?:wrong|incorrect)|you(?:'re| are| were) wrong|(?:your|the) answer (?:is|was) (?:wrong|incorrect))\.?$/i.test(text)) return { type: 'learnClarify' };
  match = text.match(/^(?:teach (?:echo|you)|learn (?:this|the following)|save (?:this )?correction|remember (?:this )?correction)\s*:\s*(.+?)\s*\|\s*(.+)$/is);
  if (match) return { type: 'learnPropose', category: /correction/i.test(text.split(':')[0]) ? 'correction' : 'fact', topic: match[1].trim(), content: match[2].trim() };
  match = text.match(/^(?:the correct (?:answer|value) (?:for|to)|correction for)\s+(.+?)\s+(?:is|:)\s+(.+)$/is);
  if (match) return { type: 'learnPropose', category: 'correction', topic: match[1].trim(), content: match[2].trim() };
  match = text.match(/^(?:please )?(?:i prefer|from now on (?:please )?|when you answer (?:please )?)\s+(?:that )?(.+)$/is);
  if (match && /\b(?:short|brief|concise|detailed|long|explanations?|answers?|responses?|step.by.step)\b/i.test(match[1])) return { type: 'learnPropose', category: 'preference', topic: 'response_style', content: match[1].trim() };
  return null;
}
