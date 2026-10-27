import { extractCodeBlock } from './file-workspace.js';
import { unitConverterScaffold } from './file-scaffolds.js';

export const FILE_HELP = [
  'Private file workspace: data/code-workspace/. No external directories, overwrites, or automatic execution.',
  '/file create <name.ext> | <single-line contents> — stage a file for approval',
  '/file paste <name.ext> — paste multiple lines, finish with :end or cancel with :cancel',
  '/file from-last <name.ext> [block number] — stage code from the preceding Echo answer',
  '/file generate <name.ext> | <requirement> — ask local LLM to generate ONE draft file (not verified)',
  '/file preview <draft-id> | /file save <draft-id> | /file cancel <draft-id>',
  '/file list | /file read <name.ext> | /file pending-tasks (draft from real saved tasks)',
  '/project scaffold unit-converter — stage 4 working browser files for approval',
  'Generated code is UNVERIFIED; JavaScript/JSON syntax checks do not establish correctness or security.',
].join('\n');

export class FileCommands {
  constructor({ files }) { this.files = files; }
  describe(item) {
    return `Draft [${item.id}] — NOTHING WRITTEN yet:\n${item.files.map(f => `- ${f.name}: ${f.verification}`).join('\n')}\nType /file preview ${item.id} to inspect, /file save ${item.id} to write, or /file cancel ${item.id}. Expires in 15 minutes.`;
  }
  async fromLast(filename, answer, index = 1) {
    const code = extractCodeBlock(answer, index);
    const draft = await this.files.stage([{ name: filename, content: code.code }]);
    const suffix = code.count > 1 ? `\nThe answer contained ${code.count} code blocks; selected block ${index}. Check its language and meaning before saving.` : '';
    return { text: this.describe(draft) + suffix };
  }
  async handle(line, { lastAnswer = '' } = {}) {
    const lower = line.toLowerCase();
    if (['/file', '/file help', '/project'].includes(lower)) return { text: FILE_HELP };
    if (lower === '/file list') {
      const files = await this.files.list();
      return { text: files.length ? files.join('\n') : 'No files in the private workspace yet.' };
    }
    if (lower.startsWith('/file read ')) {
      const name = line.slice(11).trim();
      const body = await this.files.read(name);
      return { text: `${name} (private workspace; ${Buffer.byteLength(body, 'utf8')} bytes):\n${body.slice(0, 12_000)}${body.length > 12_000 ? '\n[Read output truncated; file unchanged]' : ''}` };
    }
    if (lower.startsWith('/file create ')) {
      const found = line.slice(13).match(/^([^|]+?)\s*\|\s*([\s\S]+)$/);
      if (!found) return { text: 'Usage: /file create <name.ext> | <contents> or /file paste <name.ext> for multiline content.' };
      const draft = await this.files.stage([{ name: found[1].trim(), content: found[2] }]);
      return { text: this.describe(draft) };
    }
    if (lower.startsWith('/file generate ')) {
      const found = line.slice(15).match(/^([^|]+?)\s*\|\s*([\s\S]+)$/);
      if (!found) return { text: 'Usage: /file generate <name.ext> | <requirement>' };
      return { generateFile: { name: found[1].trim(), requirement: found[2].trim() } };
    }
    if (lower.startsWith('/file paste ')) return { paste: line.slice(12).trim(), text: 'Paste mode: enter content on following lines. Type :end on a line by itself to stage a draft, or :cancel to discard. Nothing has been saved.' };
    if (lower.startsWith('/file from-last ')) {
      const found = line.slice(16).trim().match(/^([^\s]+)(?:\s+(\d+))?$/);
      if (!found) return { text: 'Usage: /file from-last <name.ext> [code block number]' };
      return this.fromLast(found[1], lastAnswer, Number(found[2] || 1));
    }
    if (lower.startsWith('/file preview ')) return { text: this.files.preview(line.slice(14).trim()) };
    if (lower.startsWith('/file save ')) {
      const written = await this.files.save(line.slice(11).trim());
      return { text: `Created ${written.length} private file(s):\n${written.join('\n')}\nNo code was executed, and no existing file was replaced.` };
    }
    if (lower.startsWith('/file cancel ')) {
      const id = line.slice(13).trim();
      this.files.cancel(id);
      return { text: `Discarded draft [${id}]. No files written.` };
    }
    if (lower === '/project scaffold unit-converter' || lower === '/project scaffold unit converter') {
      const item = await this.files.stage(unitConverterScaffold());
      return { text: this.describe(item) + '\nOpen index.html locally in a browser after saving. Template is syntax-checked but must be tested interactively.' };
    }
    if (/^\/(?:file|project)(?:\s|$)/i.test(line)) return { text: FILE_HELP };
    return null;
  }
}
