import { calculateText } from './math.js';

export function parseIntent(raw) {
  const text = String(raw).trim();
  if (!text || text.startsWith('/')) return null;
  const math = calculateText(text);
  if (math !== null) return { type: 'math', result: math };
  if (/^(?:whoami|who am i\??|who is derrick\??|who created (?:you|echo)\??)$/i.test(text)) return { type: 'identity' };
  if (/^(?:what (?:can you do|are your (?:abilities|capabilities))\??|list your capabilities\.?|what features are implemented\??)$/i.test(text)) return { type: 'capabilities' };
  if (/^(?:what(?:'s| is) (?:the )?(?:date|day|time)(?: today| now)?\??|today'?s date\??|what date is today\??)$/i.test(text)) return { type: 'datetime' };
  if (/^(?:show|list|fetch|display|what are|tell me)(?: me)?(?: my| the)?(?: current| saved| open)? tasks\??$/i.test(text)) return { type: 'listTasks' };
  if (/^(?:show|list|fetch|display)(?: me)?(?: my| the)?(?: saved)? notes\??$/i.test(text)) return { type: 'listNotes' };
  if (/^(?:show|list|fetch|display)(?: me)?(?: my| the)?(?: calendar| events)\??$/i.test(text)) return { type: 'listEvents' };
  if (/^(?:show|list|take me through)(?: me)?(?: the)?(?: available)?(?: commands| menu)\??$/i.test(text)) return { type: 'help' };
  if (/^(?:what do you (?:use for memory|remember)|how does (?:your|echo'?s) memory work)\??$/i.test(text)) return { type: 'memoryInfo' };
  if (/^(?:give me|show me|generate)(?: my)?(?: morning| evening| daily)?(?: briefing| routine)(?: summary)?\??$/i.test(text)) return { type: 'routine' };
  let found = text.match(/^(?:please\s+)?(?:remember|remmember|memorize|memorise|save(?:\s+to\s+memory)?|add\s+to\s+(?:your\s+)?memory)\s+(?:that\s+)?(.+)$/is);
  if (found) return { type: 'remember', text: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:store|save)\s+(?:this\s+)?(?:note|fact)(?:\s+to\s+memory)?\s*:\s*(.+)$/is);
  if (found) return { type: 'remember', text: found[1].trim() };
  found = text.match(/^(.+?)(?:[.,;]\s*|\s+)(?:please\s+)?add\s+(?:that|this|it)\s+to\s+(?:your\s+|the\s+)?(?:memory|notes)\.?$/is);
  if (found) return { type: 'remember', text: found[1].trim().replace(/[.,;]$/, '') };
  if (/^(?:remember|remmember|add (?:that|this|it) to (?:your |the )?(?:notes|memory))\.?$/i.test(text)) return { type: 'clarifyMemory' };
  found = text.match(/^(?:i(?:'ve| have)\s+)?(?:finished|completed|done with)\s+(.+?)[.!]?$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:mark|set)\s+(?:the\s+task\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed)\.?$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^task\s+done\s+(.+)$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^(?:add\s+(?:a\s+)?task\s*:?|task\s+add)\s+(.+)$/i);
  if (found) return { type: 'addTask', text: found[1].trim() };
  return null;
}
