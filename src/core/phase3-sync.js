import { createHash, createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, chmod, lstat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const MAX_SNAPSHOT = 2_000_000;
const FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}\.(?:pem|echosync)$/;

function fingerprint(pem) {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'x25519') throw new Error('Public key must use X25519.');
  return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
}

async function atomic(file, value, { overwrite = true } = {}) {
  const dir = dirname(file);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  if (!overwrite) {
    await writeFile(file, value, { flag: 'wx', mode: 0o600 });
    return;
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, value, { flag: 'wx', mode: 0o600 });
    await rename(temp, file);
    await chmod(file, 0o600);
  } finally { await rm(temp, { force: true }); }
}

function validBase(name, ext) {
  if (!FILENAME.test(name) || basename(name) !== name || !name.endsWith(ext)) throw new Error(`Use a simple ${ext} filename without a path.`);
  return name;
}

function textRecord(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${label} in received snapshot.`);
  return value;
}

function validatedSnapshot(data) {
  if (data?.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.tasks) || data.notes.length > 500 || data.tasks.length > 300) throw new Error('Unsupported or oversized sync snapshot.');
  const seen = new Set();
  for (const n of data.notes) {
    if (!n || !/^[0-9a-f]{8}$/.test(n.id) || seen.has('n:' + n.id)) throw new Error('Invalid or duplicate note ID in snapshot.');
    seen.add('n:' + n.id);
    textRecord(n.text, 1500, 'note');
    if (!Number.isFinite(Date.parse(n.createdAt))) throw new Error('Invalid note date.');
  }
  for (const t of data.tasks) {
    if (!t || !/^[0-9a-f]{8}$/.test(t.id) || seen.has('t:' + t.id)) throw new Error('Invalid or duplicate task ID in snapshot.');
    seen.add('t:' + t.id);
    textRecord(t.text, 300, 'task');
    if (typeof t.done !== 'boolean' || !Number.isFinite(Date.parse(t.createdAt))) throw new Error('Invalid task state.');
  }
  return data;
}

export class ManualSync {
  constructor({ directory, memory }) {
    this.directory = directory;
    this.memory = memory;
    this.privatePath = join(directory, 'device-private.pem');
    this.publicPath = join(directory, 'device-public.pem');
    this.peersPath = join(directory, 'peers.json');
    this.inbox = join(directory, 'inbox');
    this.outbox = join(directory, 'outbox');
    this.privatePem = null;
    this.publicPem = null;
    this.peers = Object.create(null);
  }

  async init() {
    await mkdir(this.inbox, { recursive: true, mode: 0o700 });
    await mkdir(this.outbox, { recursive: true, mode: 0o700 });
    try {
      this.privatePem = await readFile(this.privatePath, 'utf8');
      this.publicPem = await readFile(this.publicPath, 'utf8');
      if (createPrivateKey(this.privatePem).asymmetricKeyType !== 'x25519') throw new Error('Invalid private key.');
      const derived = createPublicKey(createPrivateKey(this.privatePem));
      if (fingerprint(derived.export({ type: 'spki', format: 'pem' })) !== fingerprint(this.publicPem)) throw new Error('Local keypair mismatch.');
      await chmod(this.privatePath, 0o600);
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Sync keys invalid: ${error.message}`);
      this.privatePem = null;
      this.publicPem = null;
    }
    try {
      const saved = JSON.parse(await readFile(this.peersPath, 'utf8'));
      if (saved?.version !== 1 || !Array.isArray(saved.peers) || saved.peers.length > 20) throw new Error('Invalid trusted peers file.');
      this.peers = Object.create(null);
      for (const peer of saved.peers) {
        if (peer.id !== fingerprint(peer.pem) || peer.id in this.peers) throw new Error('Invalid trusted device key.');
        this.peers[peer.id] = peer.pem;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Sync peers invalid: ${error.message}`);
    }
    return this;
  }

  get id() { return this.publicPem ? fingerprint(this.publicPem) : null; }
  status() { return `Device: ${this.id || 'not initialized'}; trusted peers: ${Object.keys(this.peers).length}. Manual encrypted transfer only; no internet or automatic synchronization.`; }

  async deviceInit() {
    if (this.privatePem || this.publicPem) return this.status() + ' Existing identity retained.';
    const keys = generateKeyPairSync('x25519');
    const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });
    await atomic(this.privatePath, priv, { overwrite: false });
    await atomic(this.publicPath, pub, { overwrite: false });
    this.privatePem = priv;
    this.publicPem = pub;
    return this.status() + ` Share ONLY the public key: ${this.publicPath}`;
  }

  async inspectPublicKey(filename) {
    const name = validBase(filename, '.pem');
    const keyPath = join(this.inbox, name);
    if ((await lstat(keyPath)).isSymbolicLink()) throw new Error('Symlinks are not accepted in sync inbox.');
    const pem = await readFile(keyPath, 'utf8');
    return { filename: name, pem, id: fingerprint(pem), digest: createHash('sha256').update(pem).digest('hex') };
  }

  async trustKey(filename, digest) {
    if (!this.id) throw new Error('Initialize the local device first with /device init.');
    const key = await this.inspectPublicKey(filename);
    if (digest !== key.digest) throw new Error('The candidate key changed since approval; nothing was trusted.');
    if (key.id === this.id) throw new Error('You cannot trust your own device as a peer.');
    if (!(key.id in this.peers) && Object.keys(this.peers).length >= 20) throw new Error('Too many peers.');
    this.peers[key.id] = key.pem;
    await atomic(this.peersPath, JSON.stringify({ version: 1, peers: Object.entries(this.peers).map(([id,pem]) => ({id,pem})) }));
    return `Trusted device ${key.id}. Verify key fingerprints through a separate, trusted channel.`;
  }

  peersList() { return Object.keys(this.peers); }

  async exportSnapshot(peerId) {
    if (!this.id) throw new Error('Run /device init first.');
    const peerPem = Object.hasOwn(this.peers, peerId) ? this.peers[peerId] : null;
    if (!peerPem) throw new Error('Unknown recipient. Use /device peers.');
    this.memory.checkReady();
    const snapshot = {
      version: 1,
      notes: this.memory.listNotes(),
      tasks: this.memory.listTasks().map(t => ({ id: t.id, text: t.text, done: t.done, createdAt: t.createdAt, ...(t.completedAt ? {completedAt: t.completedAt} : {}) })),
    };
    validatedSnapshot(snapshot);
    const bytes = Buffer.from(JSON.stringify(snapshot));
    if (bytes.length > MAX_SNAPSHOT) throw new Error('Sync data exceeds 2 MB. Export fewer records.');
    const salt = randomBytes(16), iv = randomBytes(12);
    const secret = diffieHellman({ privateKey: createPrivateKey(this.privatePem), publicKey: createPublicKey(peerPem) });
    const key = hkdfSync('sha256', secret, salt, Buffer.from('echo-manual-sync-v1'), 32);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const envelope = { version: 1, sender: this.id, recipient: peerId, salt: salt.toString('base64'), iv: iv.toString('base64') };
    cipher.setAAD(Buffer.from(JSON.stringify(envelope)));
    const content = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const output = { ...envelope, ciphertext: content.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
    const filename = `echo-${this.id}-${Date.now()}-${randomUUID().slice(0, 8)}.echosync`;
    const target = join(this.outbox, filename);
    await atomic(target, JSON.stringify(output), { overwrite: false });
    return { filename, target, notes: snapshot.notes.length, tasks: snapshot.tasks.length };
  }

  async decryptInbox(filename) {
    if (!this.id) throw new Error('Run /device init first.');
    const name = validBase(filename, '.echosync');
    const file = join(this.inbox, name);
    if ((await lstat(file)).isSymbolicLink()) throw new Error('Symlinks are not accepted in sync inbox.');
    const input = await readFile(file);
    if (input.length > MAX_SNAPSHOT * 2) throw new Error('Encrypted snapshot is too large.');
    const envelope = JSON.parse(input.toString());
    if (envelope?.version !== 1 || envelope.recipient !== this.id || typeof envelope.sender !== 'string' || !Object.hasOwn(this.peers, envelope.sender)) throw new Error('Snapshot is not addressed to this device by a trusted peer.');
    for (const key of ['salt', 'iv', 'ciphertext', 'tag']) if (typeof envelope[key] !== 'string') throw new Error('Snapshot envelope is malformed.');
    const salt = Buffer.from(envelope.salt, 'base64'), iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid snapshot crypto parameters.');
    const secret = diffieHellman({ privateKey: createPrivateKey(this.privatePem), publicKey: createPublicKey(this.peers[envelope.sender]) });
    const key = hkdfSync('sha256', secret, salt, Buffer.from('echo-manual-sync-v1'), 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    const header = { version: 1, sender: envelope.sender, recipient: envelope.recipient, salt: envelope.salt, iv: envelope.iv };
    decipher.setAAD(Buffer.from(JSON.stringify(header)));
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    if (raw.length > MAX_SNAPSHOT) throw new Error('Decrypted snapshot too large.');
    return { data: validatedSnapshot(JSON.parse(raw.toString())), digest: createHash('sha256').update(input).digest('hex'), sender: envelope.sender };
  }

  preview(snapshot) {
    this.memory.checkReady();
    const localNotes = new Map(this.memory.listNotes().map(n => [n.id, n]));
    const localTasks = new Map(this.memory.listTasks().map(t => [t.id, t]));
    const incomingNotes = snapshot.notes.filter(n => !localNotes.has(n.id));
    const incomingTasks = snapshot.tasks.filter(t => !localTasks.has(t.id));
    const conflicts = [
      ...snapshot.notes.filter(n => localNotes.has(n.id) && localNotes.get(n.id).text !== n.text).map(n => 'note:' + n.id),
      ...snapshot.tasks.filter(t => localTasks.has(t.id) && (localTasks.get(t.id).text !== t.text || localTasks.get(t.id).done !== t.done)).map(t => 'task:' + t.id),
    ];
    return { newNotes: incomingNotes.length, newTasks: incomingTasks.length, conflicts };
  }

  async applyInbox(filename, digest) {
    const item = await this.decryptInbox(filename);
    if (item.digest !== digest) throw new Error('Snapshot changed since approval. No data imported.');
    const plan = this.preview(item.data);
    if (plan.conflicts.length) throw new Error(`Conflicting records: ${plan.conflicts.join(', ')}. No changes applied; resolve manually.`);
    const old = structuredClone(this.memory.data);
    try {
      const noteIds = new Set(old.notes.map(n => n.id));
      const taskIds = new Set(old.tasks.map(t => t.id));
      for (const note of item.data.notes) if (!noteIds.has(note.id)) this.memory.data.notes.push({ ...note });
      for (const task of item.data.tasks) if (!taskIds.has(task.id)) this.memory.data.tasks.push({ ...task });
      if (this.memory.data.notes.length > 500 || this.memory.data.tasks.length > 300) throw new Error('Import exceeds memory limits.');
      if (plan.newNotes || plan.newTasks) await this.memory.save();
      return plan;
    } catch (error) { this.memory.data = old; throw error; }
  }
}
