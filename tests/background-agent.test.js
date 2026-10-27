import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackgroundAgent, backgroundCommand } from '../src/core/background-agent.js';

async function fixture(t, now = '2026-10-27T09:05:00+03:00') {
  const dir = await mkdtemp(join(tmpdir(),'echo-bg-'));
  t.after(() => rm(dir,{force:true,recursive:true}));
  const tasks = [{ id: '12345678', text: 'Revise networking', done: false }, { id: 'abcdefab', text: 'Completed work', done: true }];
  const agent = await new BackgroundAgent({ filePath: join(dir,'data','bg.json'), inboxDir:join(dir,'data','inbox'), memory:{ listTasks: ({ includeDone }={}) => includeDone === false ? tasks.filter(x=>!x.done) : tasks }, calendar:{ list:()=>[] }, timeZone:'Africa/Nairobi', clock: () => new Date(now) }).init();
  return { agent,dir };
}

test('unapproved jobs never run, approved jobs run once per local day and persist private report', async t => {
  const {agent,dir}=await fixture(t);
  const proposed=agent.propose('tasks','12:00');
  assert.deepEqual(await agent.runDue(),[]);
  assert.equal(agent.jobs().length,0);
  const job=await agent.confirm(proposed.id);
  assert.equal(job.enabled,true);
  assert.deepEqual(await agent.runDue(),[]);
  const result=await agent.runDue({ now:new Date('2026-10-27T12:01:00+03:00') });
  assert.equal(result[0].status,'success');
  assert.match(await readFile(result[0].report,'utf8'),/Revise networking/);
  assert.doesNotMatch(await readFile(result[0].report,'utf8'),/Completed work/);
  assert.equal((await lstat(result[0].report)).mode & 0o077,0);
  assert.deepEqual(await agent.runDue({now:new Date('2026-10-27T12:03:00+03:00')}),[]);
  const reopened=await new BackgroundAgent({filePath:join(dir,'data','bg.json'),inboxDir:join(dir,'data','inbox'),memory:agent.memory,timeZone:'Africa/Nairobi'}).init();
  assert.equal(reopened.jobs()[0].lastRunDay,'2026-10-27');
  assert.equal((await readdir(join(dir,'data','inbox'))).length,1);
});

test('schedule validates type and time, catches up only within window and honors pause',async t=>{
  const {agent}=await fixture(t);
  assert.throws(()=>agent.propose('shell','10:00'),/Allowed/);
  assert.throws(()=>agent.propose('tasks','99:00'),/Allowed/);
  const job=await agent.confirm(agent.propose('tasks','08:00').id);
  assert.deepEqual(await agent.runDue({ now:new Date('2026-10-27T14:30:00+03:00') }), []);
  await agent.change(job.id,'pause');
  assert.deepEqual(await agent.runDue({ now:new Date('2026-10-28T08:05:00+03:00') }), []);
  await agent.change(job.id,'resume');
  assert.equal((await agent.runDue({ now:new Date('2026-10-28T08:05:00+03:00') }))[0].status,'success');
});

test('background command is explicit, proposes before persisting and never promises systemd state',async t=>{
  const {agent}=await fixture(t);
  const request=await backgroundCommand(agent,'/background schedule tasks 12:00');
  const id=request.text.match(/\[([0-9a-f]{8})\]/)[1];
  assert.equal(agent.jobs().length,0);
  assert.match((await backgroundCommand(agent,`/background confirm ${id}`)).text,/timer must be enabled/);
  assert.match((await backgroundCommand(agent,'/background status')).text,/systemctl/);
  await backgroundCommand(agent,`/background delete ${id}`);
  assert.equal(agent.jobs().length,0);
});

test('background worker cannot run duplicate concurrent tick and records failures truthfully',async t=>{
  const {agent}=await fixture(t);
  const job=await agent.confirm(agent.propose('resources','08:00').id);
  const run=await agent.runDue({now:new Date('2026-10-27T08:01:00+03:00')});
  assert.equal(run[0].status,'failed');
  assert.match(run[0].error,/unavailable/);
  assert.equal(agent.audit()[0].status,'failed');
  assert.deepEqual(await agent.runDue({now:new Date('2026-10-27T08:02:00+03:00')}),[]);
  assert.equal(agent.jobs()[0].id,job.id);
});

test('unsafe background config fails closed rather than resetting', async t=>{
  const {agent}=await fixture(t);
  const {writeFile}=await import('node:fs/promises');
  const {mkdir}=await import('node:fs/promises'); await mkdir(join(agent.filePath,'..'),{recursive:true});
  await writeFile(agent.filePath,'{"version":1,"jobs":[{"id":"test","type":"shell","at":"12:00","enabled":true,"lastRunDay":null}],"audit":[]}');
  await assert.rejects(new BackgroundAgent({filePath:agent.filePath,inboxDir:agent.inboxDir}).init(),/cannot safely load/i);
});
