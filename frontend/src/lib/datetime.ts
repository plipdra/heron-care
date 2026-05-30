// Display formatting for booking slots, appointments, and records.
//
// Heron is a Philippine telehealth service: doctors author their hours in PH
// time, so every time and date here renders in Asia/Manila and is labelled
// Philippine Standard Time — consistent for a viewer in any timezone, instead of
// shifting with the browser's clock. Times read warm ("3:00 PM", not "15:00");
// pair with the `.tabular` class so digits don't jitter.

const PH_TZ = 'Asia/Manila';

// "3:00 PM" — in PH time.
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: PH_TZ,
  });
}

// "Friday, May 30 at 3:00 PM", or with the year ("…, 2026 at …") for past dates
// where the year is otherwise ambiguous (precise = trust). PH time.
export function formatFullDateTime(iso: string, withYear = false): string {
  const date = new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: PH_TZ,
    ...(withYear ? { year: 'numeric' } : {}),
  });
  return `${date} at ${formatTime(iso)}`;
}

// The calendar Y/M/D of an instant in PH time ("YYYY-MM-DD") — a stable key for
// grouping and comparing days in Manila, never in the browser's zone.
export function phDayKey(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Whole years between a birthday ("YYYY-MM-DD") and today. Parses the date parts
// directly and compares against today in PH, so age never shifts with the
// viewer's timezone.
export function deriveAge(birthday: string): number {
  const [by, bm, bd] = birthday.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = phDayKey(new Date()).split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// "12 Mar 1991" — a date with no time, for a birthday. PH time.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: PH_TZ,
  });
}

// Day-chip label: "Today" / "Tomorrow" for the first two days (warm + precise),
// otherwise weekday + day-of-month — all evaluated in PH time.
export function formatDayChip(iso: string): { weekday: string; day: string } {
  const now = new Date();
  const key = phDayKey(iso);
  const todayKey = phDayKey(now);
  const tomorrowKey = phDayKey(new Date(now.getTime() + 86_400_000));

  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TZ,
    day: 'numeric',
  }).format(new Date(iso));

  if (key === todayKey) return { weekday: 'Today', day };
  if (key === tomorrowKey) return { weekday: 'Tomorrow', day };
  return {
    weekday: new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      timeZone: PH_TZ,
    }),
    day,
  };
}

// The app renders every time in PH, so the zone label is fixed — shown under
// slot grids and on appointment lists so the times are unambiguous.
export function localTimeZoneLabel(): string {
  return 'Philippine Standard Time';
}

// The long zone name for a specific IANA zone, e.g. "Asia/Manila" → "Philippine
// Standard Time". Used where times belong to a fixed zone (a doctor's authored
// hours) rather than the viewer's browser.
export function timeZoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: 'long',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export type SlotDay = {
  key: string;
  startsAt: string; // first slot's start — used for the day-chip label
  slots: { startsAt: string; endsAt: string }[];
};

// Groups a flat, ascending list of slots into PH calendar days, preserving
// order. The backend already returns slots sorted and pre-filtered.
export function groupSlotsByDay(
  slots: { startsAt: string; endsAt: string }[],
): SlotDay[] {
  const days: SlotDay[] = [];
  const byKey = new Map<string, SlotDay>();
  for (const slot of slots) {
    const key = phDayKey(slot.startsAt);
    let day = byKey.get(key);
    if (!day) {
      day = { key, startsAt: slot.startsAt, slots: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.slots.push(slot);
  }
  return days;
}
