export function routineSummary({ profile, memory, now = new Date(), timeZone = 'Africa/Nairobi' }) {
  const label = new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(now);
  const tasks = memory.listTasks({ includeDone: false });
  const completed = memory.listTasks().filter(task => task.done).length;
  const priorities = Array.isArray(profile?.goals) ? profile.goals.slice(0, 2) : [];
  const lines = [
    `Routine snapshot — ${label} (${timeZone})`,
    `Current focus: ${profile?.currentFocus || 'Not configured in personal profile.'}`,
    `Open tasks (${tasks.length}):`,
    ...(tasks.length ? tasks.slice(0, 8).map((task, i) => `${i + 1}. [${task.id}] ${task.text}`) : ['No tasks saved. Use /task add <description>.']),
  ];
  if (tasks.length > 8) lines.push(`...and ${tasks.length - 8} more open tasks.`);
  lines.push(`Completed tasks on record: ${completed}`);
  if (priorities.length) lines.push('Long-term goals:', ...priorities.map(goal => `- ${goal}`));
  lines.push('This is a snapshot of manually saved tasks and profile goals, not a synced calendar or automatic reminder schedule.');
  return lines.join('\n');
}
