const trimEcho = raw => String(raw).trim().replace(/^(?:hey[, ]+)?echo[,!: ]+/i, '');

export function parseSmartMemory(raw) {
  const input = trimEcho(raw);
  let match = input.match(/^(?:add|save|put|store)\s+(?:this\s+)?(?:to|in|into)\s+(?:my\s+)?memory\s*[:,-]?\s*(.+)$/is);
  if (!match) match = input.match(/^remember\s+that\s+(.+)$/is);
  if (!match) return null;
  const body = match[1].trim();
  if (!body) return { type: 'clarify' };
  let m = body.match(/^(?:note|notes)\s*\|\s*(.+)$/is);
  if (m) return { type: 'note', content: m[1].trim() };
  m = body.match(/^(?:task|todo|to-do)\s*\|\s*(.+)$/is);
  if (m) return { type: 'task', content: m[1].trim() };
  m = body.match(/^(?:done|completed task)\s*\|\s*(.+)$/is);
  if (m) return { type: 'complete', content: m[1].trim() };
  m = body.match(/^(?:event|calendar)\s*\|\s*(\S+)\s*\|\s*(.+)$/is);
  if (m) return { type: 'event', at: m[1], content: m[2].trim() };
  m = body.match(/^project\s*\|\s*([^|]+)\s*\|\s*(active|maintenance|planning|on hold|concept|completed|unknown)\s*\|\s*(.+)$/is);
  if (m) return { type: 'project', name: m[1].trim(), status: m[2].toLowerCase(), content: m[3].trim() };
  m = body.match(/^(correction|fact|preference)\s*\|\s*([^|]+)\s*\|\s*(.+)$/is);
  if (m) return { type: 'learning', category: m[1].toLowerCase(), name: m[2].trim(), content: m[3].trim() };
  m = body.match(/^(?:that\s+)?(?:i\s+)?(?:need to|must|should|plan to|have to)\s+((?:study|revise|review|finish|complete|practice|learn|work on|build|implement|test)\b.+)$/is);
  if (m) return { type: 'task', content: m[1].trim() };
  m = body.match(/^(?:that\s+)?(?:i\s+)?(?:finished|completed|have finished|have completed)\s+(.+)$/is);
  if (m) return { type: 'complete', content: m[1].trim() };
  m = body.match(/^(?:that\s+)?(?:i\s+)?(?:prefer|want you to)\s+(.+)$/is);
  if (m) return { type: 'learning', category: 'preference', name: 'response_style', content: m[1].trim() };
  m = body.match(/^(?:that\s+)?(?:the\s+)?(?:correct\s+answer\s+for|correction\s+for)\s+(.+?)\s+is\s+(.+)$/is);
  if (m) return { type: 'learning', category: 'correction', name: m[1].trim(), content: m[2].trim() };
  if (body.toLowerCase().startsWith('that ')) return { type: 'note', content: body.slice(5) };
  return { type: 'note', content: body.replace(/^that\s+/i, '') };
}
