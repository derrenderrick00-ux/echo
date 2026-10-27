export function parseFileIntent(raw) {
  const text = String(raw).trim().replace(/^(?:hey[, ]+)?echo[,!: ]+/i, '').replace(/^please\s+/i, '');
  if (!text || text.startsWith('/')) return null;
  if (/^(?:can you\s+|could you\s+|would you\s+)?(?:create|make|save|generate|write)\s+(?:(?:a|the)\s+)?(?:(?:well[- ]formatted|formatted)\s+)?(?:markdown|md)\s+file\s+(?:for|on|of|with|listing|containing)\s+(?:my\s+)?(?:pending|incomplete|open|remaining)\s+tasks?\??[.!]?$/i.test(text) || /^(?:create|make|generate)\s+(?:(?:a|the)\s+)?(?:well[- ]formatted\s+)?(?:md|markdown)\s+file\s+(?:of|on|for)\s+(?:my\s+)?pending\s+tasks?$/i.test(text)) return { type: 'pendingTasksFile', name: 'pending_tasks.md' };
  if (/^(?:(?:can|could|would) you\s+)?(?:create|make|generate|write)\b[\s\S]*\b(?:md|markdown)\b[\s\S]*\b(?:file|pending_tasks)\b[\s\S]*\b(?:pending|open|incomplete|remaining)[-_ ]?tasks?\b/i.test(text) ||
      /^(?:(?:can|could|would) you\s+)?(?:create|make|generate|write)\b[\s\S]*\b(?:file|pending_tasks)\b[\s\S]*\b(?:my\s+)?(?:pending|open|incomplete|remaining)[-_ ]?tasks?\b/i.test(text) ||
      /^(?:create|make|generate)\s+(?:a\s+)?(?:well\s*formatted\s+)?(?:md|markdown)\s+file\s+in\s+pending_tasks\b/i.test(text)) return { type: 'pendingTasksFile', name: 'pending_tasks.md' };
  if (/^(?:can you |could you |would you )?(?:create|make|build|scaffold|generate)\s+(?:(?:a|an)\s+)?(?:working\s+)?(?:html[ ,+]*(?:css[ ,+]*)(?:and |\+\s*)?(?:js|javascript)\s+)?(?:unit[ -]?converter|files? for (?:a )?unit[ -]?converter)(?:\s+(?:using|with|in)\s+(?:html|css|js|javascript|and|,|\+|\s)+)?[?.!]?$/i.test(text)) return { type: 'scaffoldConverter' };
  if (/^(?:(?:can|could|would) you\s+)?(?:generate|write|create)\s+code\s+for\s+(?:a\s+)?unit[ -]?converter(?:\s+(?:using|with|in)\s+.+)?[?.!]?$/i.test(text)) return { type: 'scaffoldConverter' };
  let found = text.match(/^(?:(?:can|could|would) you\s+)?(?:create|make|write|save)\s+(?:(?:a|an)\s+)?(?:new\s+)?(?:file\s+)?(?:named|called)\s+([^\s,]+)\s+(?:with|containing|that contains)\s+(.+)$/is);
  if (found) return { type: 'createFile', name: found[1], content: found[2] };
  found = text.match(/^(?:(?:can|could|would) you\s+)?(?:create|make|write)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?([^\s,]+\.(?:js|mjs|html|css|json|md|txt|c|h|py))\s+(?:with|containing|that contains)\s+(.+)$/is);
  if (found) return { type: 'createFile', name: found[1], content: found[2] };
  found = text.match(/^(?:(?:can|could|would) you\s+)?(?:save|put|write)\s+(?:the\s+)?(?:last\s+)?(?:code|previous code|generated code)(?:\s+(?:in|into|as|to))\s+([^\s]+\.(?:js|mjs|html|css|json|md|txt|c|h|py))\.?$/i);
  if (found) return { type: 'saveLastCode', name: found[1] };
  found = text.match(/^(?:(?:can|could|would) you\s+)?(?:create|generate|write|make)\s+(?:a\s+)?(?:(?:javascript|js|html|css|python|c)\s+)?file\s+(?:called|named)\s+([^\s,]+\.(?:js|mjs|html|css|json|md|txt|c|h|py))\s+(?:that|which|to)\s+(.+)$/is);
  if (found) return { type: 'generateFile', name: found[1], requirement: found[2] };
  if (/^(?:can|could|would) you (?:create|make|write|save) (?:files?|a file|project files)\??$/i.test(text) || /^(?:create|write|save) (?:files?|a file)\??$/i.test(text)) return { type: 'fileHelp' };
  return null;
}
