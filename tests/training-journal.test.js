import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TrainingJournal, trainingCommand } from '../src/core/training-journal.js';

async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'echo-train-'));
  t.after(()=>rm(dir,{force:true,recursive:true}));
  return {journal:await new TrainingJournal({filePath:join(dir,'private','approved.json')}).init(),dir};
}

test('training examples require explicit approval, reject secrets, do not train LLM or auto-harvest chat',async t=>{
  const {journal}=await fixture(t);
  const draft=journal.propose('What is a router?','A router forwards packets between networks.');
  assert.equal(journal.list().length,0);
  await journal.approve(draft.id);
  assert.equal(journal.list().length,1);
  assert.throws(()=>journal.propose('What is a router?','incorrect'),/already approved/);
  assert.throws(()=>journal.propose('credential','api_key=abcdef0123456789'),/credential/);
  assert.match((await trainingCommand(journal,'/train list')).text,/router/);
  assert.equal((await lstat(journal.filePath)).mode & 0o077,0);
});

test('training dataset export splits by prompt without leakage, preserves role schema',async t=>{
  const {journal,dir}=await fixture(t);
  for (let i=0;i<10;i++) await journal.approve(journal.propose(`Question ${i}`,`Verified answer ${i}`).id);
  const result=await journal.exportSplit({dir:join(dir,'ready')});
  assert.equal(result.train+result.eval,10);
  const train=(await readFile(result.trainPath,'utf8')).trim().split('\n').map(JSON.parse);
  const held=(await readFile(result.evalPath,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(train.length+held.length,10);
  assert.deepEqual(train[0].prompt[0].role,'user');
  assert.deepEqual(train[0].completion[0].role,'assistant');
  assert.equal((await lstat(result.trainPath)).mode & 0o077,0);
  const seen=new Set(train.map(x=>x.prompt[0].content));
  assert.ok(held.every(x=>!seen.has(x.prompt[0].content)));
});

test('training proposal expires/rejection and invalid journal is rejected',async t=>{
  const {journal}=await fixture(t);
  const proposal=journal.propose('A','B');
  assert.ok(journal.cancel(proposal.id));
  await assert.rejects(journal.approve(proposal.id),/missing or expired/);
  await assert.rejects(journal.exportSplit({dir:'not-used'}),/at least 8/i);
  const {writeFile}=await import('node:fs/promises');
  const {mkdir}=await import('node:fs/promises'); await mkdir(join(journal.filePath,'..'),{recursive:true});
  await writeFile(journal.filePath,'{"version":1,"examples":[{"id":"bad"}]}');
  await assert.rejects(new TrainingJournal({filePath:journal.filePath}).init(),/cannot safely read/i);
});
