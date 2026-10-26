export class Phase3Commands {
  constructor({ journal, sync, memory }) {
    this.journal = journal;
    this.sync = sync;
    this.memory = memory;
  }

  help() {
    return [
      'Phase 3 experimental: permissioned LOCAL actions and manual encrypted device transfer.',
      'Actions: /actions /approve <id> /reject <id> /audit',
      'Delete: /task delete <id> /note delete <id> (requires approval)',
      'Devices: /device init /device info /device peers /device trust <filename.pem>',
      'Sync: /sync status /sync export <trusted-peer-id> /sync preview <filename.echosync> /sync import <filename.echosync>',
      'Only import files from data/sync/inbox. Exported ciphertext is written to data/sync/outbox.',
      'No automatic networking, background autonomy, cloud API, phone actions, or device pairing over the network.',
      'Verify a peer fingerprint independently before approving trust. Never share device-private.pem.',
    ].join('\n');
  }

  proposalText(item) { return `Approval needed [${item.id}]: ${item.summary}\nType /approve ${item.id} to execute or /reject ${item.id} to cancel. Proposals expire after 15 minutes.`; }

  async handle(input) {
    const text = String(input).trim();
    const low = text.toLowerCase();
    if (['/phase3', '/phase3 help'].includes(low)) return { text: this.help() };
    if (low === '/actions') return { text: this.journal.list().map(a => `[${a.id}] ${a.summary}`).join('\n') || 'No pending actions.' };
    if (low === '/audit') return { text: this.journal.audit().map(a => `${a.at} ${a.id} ${a.type}: ${a.status}${a.detail ? ' — ' + a.detail : ''}`).join('\n') || 'No local action audit yet.' };
    if (low === '/device info' || low === '/sync status') return { text: this.sync.status() };
    if (low === '/device init') return { text: await this.sync.deviceInit() };
    if (low === '/device peers') return { text: this.sync.peersList().join('\n') || 'No trusted devices.' };
    if (low.startsWith('/device trust ')) {
      const candidate = await this.sync.inspectPublicKey(text.slice(14).trim());
      const action = await this.journal.propose('trust-device', `Trust public key fingerprint ${candidate.id} from inbox/${candidate.filename}. Compare this fingerprint separately first.`, { filename: candidate.filename, digest: candidate.digest });
      return { text: this.proposalText(action) };
    }
    if (low.startsWith('/sync export ')) {
      const snapshot = await this.sync.exportSnapshot(text.slice(13).trim());
      return { text: `Created encrypted snapshot: ${snapshot.target}\n${snapshot.notes} notes, ${snapshot.tasks} tasks. Transfer ONLY this encrypted file to the recipient's data/sync/inbox; do not transfer private keys.` };
    }
    if (low.startsWith('/sync preview ') || low.startsWith('/sync import ')) {
      const filename = text.slice(low.startsWith('/sync preview ') ? 14 : 13).trim();
      const result = await this.sync.decryptInbox(filename);
      const details = this.sync.preview(result.data);
      const summary = `Authenticated encrypted snapshot from ${result.sender}: ${details.newNotes} new notes, ${details.newTasks} new tasks, ${details.conflicts.length} conflicting records.`;
      if (low.startsWith('/sync preview ')) return { text: summary + (details.conflicts.length ? `\nConflicts: ${details.conflicts.join(', ')}. Nothing will be overwritten.` : '') };
      if (details.conflicts.length) return { text: summary + '\nImport denied: manually resolve conflicts first. No data changed.' };
      const action = await this.journal.propose('import-snapshot', `Import ${details.newNotes} notes and ${details.newTasks} tasks from trusted device ${result.sender} (${filename}).`, { filename, digest: result.digest });
      return { text: `${summary}\n${this.proposalText(action)}` };
    }
    if (low.startsWith('/note delete ') || low.startsWith('/task delete ')) {
      const note = low.startsWith('/note');
      const id = text.slice(note ? 13 : 13).trim();
      const item = note ? this.memory.listNotes().find(x => x.id === id) : this.memory.listTasks().find(x => x.id === id);
      if (!item) return { text: `${note ? 'Note' : 'Task'} [${id}] not found. No data changed.` };
      const action = await this.journal.propose(note ? 'delete-note' : 'delete-task', `Permanently delete ${note ? 'note' : 'task'} [${id}]: ${item.text.slice(0, 100)}`, { id, text: item.text });
      return { text: this.proposalText(action) };
    }
    if (low.startsWith('/approve ') || low.startsWith('/reject ')) {
      const approved = low.startsWith('/approve ');
      const id = text.slice(approved ? 9 : 8).trim();
      const action = this.journal.get(id);
      if (!action) return { text: `No pending action [${id}]. Use /actions.` };
      if (this.journal.isExpired(action)) {
        await this.journal.finalize(id, 'expired');
        return { text: `Approval expired for [${id}]. Repeat the request.` };
      }
      if (!approved) {
        await this.journal.finalize(id, 'rejected');
        return { text: `Rejected action [${id}]. No changes made.` };
      }
      let detail;
      if (action.type === 'add-task') {
        const item = await this.memory.addTask(action.payload.text);
        detail = `saved task [${item.id}]: ${item.text}`;
      } else if (action.type === 'delete-note') {
        const target = this.memory.listNotes().find(x => x.id === action.payload.id);
        if (!target || target.text !== action.payload.text) throw new Error('Note changed since approval proposal. Nothing deleted.');
        if (!await this.memory.deleteNote(action.payload.id)) throw new Error('Note no longer exists.');
        detail = 'note removed';
      } else if (action.type === 'delete-task') {
        const target = this.memory.listTasks().find(x => x.id === action.payload.id);
        if (!target || target.text !== action.payload.text) throw new Error('Task changed since approval proposal. Nothing deleted.');
        const before = this.memory.data.tasks;
        this.memory.data.tasks = before.filter(x => x.id !== target.id);
        try { await this.memory.save(); }
        catch (error) { this.memory.data.tasks = before; throw error; }
        detail = 'task removed';
      } else if (action.type === 'trust-device') {
        detail = await this.sync.trustKey(action.payload.filename, action.payload.digest);
      } else if (action.type === 'import-snapshot') {
        const result = await this.sync.applyInbox(action.payload.filename, action.payload.digest);
        detail = `imported ${result.newNotes} notes and ${result.newTasks} tasks`;
      } else throw new Error('Action type unsupported.');
      await this.journal.finalize(id, 'approved', detail);
      return { text: `Approved [${id}]: ${detail}. Recorded in local audit.` };
    }
    if (/^\/(?:sync|device|approve|reject|actions|audit|phase3|note delete|task delete)(?:\s|$)/i.test(text)) return { text: this.help() };
    return null;
  }
}
