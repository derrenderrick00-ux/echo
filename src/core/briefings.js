import { routineSummary } from './routine.js';
import { formatEvents } from './calendar.js';

export function briefing({ period = 'morning', profile, memory, calendar, now = new Date(), timeZone = 'Africa/Nairobi' }) {
  if (!['morning', 'evening'].includes(period)) throw new Error('Briefing type must be morning or evening.');
  const parts = [`${period === 'morning' ? 'Morning' : 'Evening'} briefing`, routineSummary({ profile, memory, now, timeZone })];
  const events = calendar?.list({ start: new Date(now.getTime() - 86400000), end: new Date(now.getTime() + 86400000) }) ?? [];
  parts.push('Local calendar events within ±24 hours:', formatEvents(events, timeZone));
  parts.push('This is an on-demand local briefing. No external calendar was checked and no background reminder is promised.');
  return parts.join('\n');
}
