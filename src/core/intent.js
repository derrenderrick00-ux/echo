// Deterministic routing for explicit, user-authorized local operations.
// Ambiguous references do not cause silent memory writes or task changes.
import { calculateText } from './math.js';

export function parseIntent(raw) {
  const text = String(raw).trim();
  if (!text || text.startsWith('/')) return null;

  const mathResult = calculateText(text);
  if (mathResult !== null) return { type: 'math', result: mathResult };

  if (/^(?:whoami|who am i\??|who is derrick\??|who created (?:you|echo)\??)$/i.test(text)) {
    return { type: 'identity' };
  }
  if (/^(?:what (?:can you do|are your (?:abilities|capabilities))\??|list your capabilities\.?|what features are implemented\??)$/i.test(text)) {
    return { type: 'capabilities' };
  }

  let match = text.match(/^(?:please\s+)?remember\s+(?:that\s+)?(.+)$/is);
  if (match) return { type: 'remember', text: match[1].trim() };
  match = text.match(/^(?:please\s+)?(?:save|store)\s+(?:this\s+)?(?:note|fact)(?:\s+to\s+memory)?\s*:\s*(.+)$/is);
  if (match) return { type: 'remember', text: match[1].trim() };
  match = text.match(/^(.+?)(?:[.,;]\s*|\s+)(?:please\s+)?add\s+(?:that|this)\s+to\s+(?:your\s+|the\s+)?memory\.?$/is);
  if (match) return { type: 'remember', text: match[1].trim().replace(/[.,;]$/, '') };
  if (/^(?:add (?:that|this) to (?:your |the )?memory|remember (?:that|this))\.?$/i.test(text)) {
    return { type: 'clarifyMemory' };
  }

  match = text.match(/^(?:i(?:'ve| have)\s+)?(?:finished|completed|done with)\s+(.+?)[.!]?$/i);
  if (match) return { type: 'completeTask', reference: match[1].trim() };
  match = text.match(/^(?:please\s+)?(?:mark|set)\s+(?:the\s+task\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed)\.?$/i);
  if (match) return { type: 'completeTask', reference: match[1].trim() };
  match = text.match(/^task\s+done\s+(.+)$/i);
  if (match) return { type: 'completeTask', reference: match[1].trim() };
  match = text.match(/^(?:add\s+(?:a\s+)?task\s*:?|task\s+add)\s+(.+)$/i);
  if (match) return { type: 'addTask', text: match[1].trim() };

  return null;
}
