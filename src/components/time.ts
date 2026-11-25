/** Time zones offered by the Countdown and Clock. 'local' = the viewer's own device time. */
export const TIME_ZONES: ReadonlyArray<readonly [string, string]> = [
  ['local', "Viewer's local time"], ['UTC', 'UTC'],
  ['Europe/London', 'London'], ['Europe/Prague', 'Prague'], ['Europe/Berlin', 'Berlin'], ['Europe/Paris', 'Paris'],
  ['Europe/Warsaw', 'Warsaw'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'],
  ['America/Los_Angeles', 'Los Angeles'], ['Asia/Dubai', 'Dubai'], ['Asia/Singapore', 'Singapore'],
  ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'],
];

/** Offset of a time zone at a given moment, in ms (wall clock minus UTC). */
function tzOffsetMs(epoch: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(epoch))) p[x.type] = x.value;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asUtc - epoch;
}

/** "2026-12-31T23:59" in a named time zone → epoch ms (daylight saving handled). NaN if invalid. */
export function zonedToEpoch(wall: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return Number.NaN;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const first = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(first, tz);
}
