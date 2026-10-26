import { calculateText } from './math.js';

export function parseIntent(raw) {
  const text = String(raw).trim().replace(/^(?:(?:hey|hi|hello)\s+)?echo[,!:]\s*/i, '');
  if (!text || text.startsWith('/')) return null;
  const math = calculateText(text);
  if (math !== null) return { type: 'math', result: math };
  if (/\b(?:ollama stream timed out|what (?:do you mean by|does) [\"']?ollama stream timed out|why did (?:ollama|you) time out)\b/i.test(text)) return { type: 'timeoutInfo' };
  if (/^why (?:does|is) (?:your|echo'?s) voice (?:not working|not work|not functioning|fail(?:ing)?|not responding)\??$/i.test(text)) return { type: 'voiceHelp' };
  if (/^(?:how (?:can|do) i (?:configure|set up|install) (?:your|echo'?s|the) voice|help me configure (?:your|echo'?s) voice|(?:configure|set up|install) (?:your|echo'?s) voice|why (?:doesn't|does not|isn't|is not) (?:your|echo'?s) voice work\??)$/i.test(text)) return { type: 'voiceHelp' };
  if (/^(?:i (?:want|need) (?:you|echo) to (?:respond|speak|talk) (?:with|in) voice|(?:enable|turn on) (?:your )?voice(?: mode| responses)?|(?:respond|reply|answer) (?:with|in) voice)\.?$/i.test(text)) return { type: 'voiceRequest' };
  if (/^(?:what(?:'s| is) (?:your )?voice (?:status|configuration)|is (?:your )?voice (?:working|configured))\??$/i.test(text)) return { type: 'voiceStatus' };
  if (/^(?:run (?:new )?date\(\) (?:in (?:your )?(?:js|javascript)(?: file)?)?|what is (?:today'?s|the current) date|today'?s date|what date is today)\??$/i.test(text)) {
    if (/^run /i.test(text)) return { type: 'javascriptDate' };
    return { type: 'datetime' };
  }
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
  found = text.match(/^(?:i(?:'ve| have| just)\s+)?(?:finished|completed|done with)\s+(.+?)[.!]?$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:mark|set)\s+(?:the\s+task\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed)\.?$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^task\s+done\s+(.+)$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^(?:add\s+(?:a\s+)?task\s*:?|task\s+add)\s+(.+)$/i);
  if (found) return { type: 'addTask', text: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:please\s+)?(?:add|create|make|put|save)\s+(?:a\s+)?(?:new\s+)?(?:task|to-do|todo)(?:\s+(?:for|to|called|named|that says))?\s*:?\s+(.+)$/i);
  if (found) return { type: 'addTask', text: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:please\s+)?(?:add|put|save)\s+(.+?)\s+(?:to|on|in)\s+(?:my|the)\s+(?:tasks?|to-?do\s+list|task\s+list)[.?!]?$/i);
  if (found) return { type: 'addTask', text: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:remind\s+me\s+to)\s+(.+)$/i);
  if (found) return { type: 'addTask', text: found[1].trim(), reminderUnsupported: true };
  found = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:mark|tick\s+off|check\s+off)\s+(.+?)\s+(?:as\s+)?(?:done|completed|finished)\.?$/i);
  if (found) return { type: 'completeTask', reference: found[1].trim() };
  found = text.match(/^(?:please\s+)?(?:i\s+)?(?:need|have|got|want)\s+to\s+(.+)$/i);
  if (found && /^(?:study|revise|review|finish|complete|practice|work\s+on|submit|read|prepare|learn(?!\s+(?:how|about)))\b/i.test(found[1])) return { type: 'suggestTask', text: found[1].trim() };
  if (/^(?:what(?:'s| is)\s+on\s+my\s+(?:plate|to-?do\s+list)|what\s+do\s+i\s+need\s+to\s+do|do\s+i\s+have\s+any\s+(?:pending|open)\s+tasks)\??$/i.test(text)) return { type: 'listTasks' };
  found = text.match(/^(?:please\s+)?(?:delete|remove|get\s+rid\s+of)\s+(?:the\s+)?(?:task|to-?do)\s+([0-9a-f]{8})\.?$/i);
  if (found) return { type: 'deleteTask', id: found[1] };
  found = text.match(/^(?:please\s+)?(?:delete|remove|get\s+rid\s+of)\s+(?:the\s+)?note\s+([0-9a-f]{8})\.?$/i);
  if (found) return { type: 'deleteNote', id: found[1] };
  if (/^(?:send|email|text|message|call)\s+(?:someone|a\s+person|[a-z][\s\S]+)/i.test(text)) return { type: 'unsupportedExternal' };

  return null;
}
