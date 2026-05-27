// Local-timezone formatting for booking slots and confirmations.
//
// The backend returns slot times as UTC Instants that represent the doctor's
// local-timezone half-hour boundaries. The patient attends in their OWN time,
// so every time here renders in the browser's local zone and we label the zone
// explicitly — "precise = trust" (BRAND.md §4). Times read warm ("3:00 PM",
// not "15:00"); see BRAND.md §6 — pair with the `.tabular` class so digits
// don't jitter.

// "3:00 PM"
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// "Friday, May 30 at 3:00 PM", or with the year ("…, 2026 at …") for past dates
// where the year is otherwise ambiguous (precise = trust).
export function formatFullDateTime(iso: string, withYear = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
  return `${date} at ${formatTime(iso)}`;
}

// Stable key for grouping slots into local calendar days.
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Day-chip label: "Today" / "Tomorrow" for the first two days (warm + precise),
// otherwise weekday + day-of-month, e.g. { weekday: 'Fri', day: '30' }.
export function formatDayChip(iso: string): { weekday: string; day: string } {
  const d = new Date(iso);
  const now = new Date();
  const today = localDayKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = localDayKey(tomorrowDate);
  const key = localDayKey(d);

  const day = String(d.getDate());
  if (key === today) return { weekday: 'Today', day };
  if (key === tomorrow) return { weekday: 'Tomorrow', day };
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day,
  };
}

// e.g. "Eastern Standard Time" / "Philippine Standard Time" — the resolved
// long zone name, shown under the slot grid so the displayed times are
// unambiguous to a viewer in any timezone.
export function localTimeZoneLabel(): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'long',
  }).formatToParts(new Date());
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'your local time';
}

export type SlotDay = {
  key: string;
  startsAt: string; // first slot's start — used for the day-chip label
  slots: { startsAt: string; endsAt: string }[];
};

// Groups a flat, ascending list of slots into local calendar days, preserving
// order. The backend already returns slots sorted and pre-filtered.
export function groupSlotsByDay(
  slots: { startsAt: string; endsAt: string }[],
): SlotDay[] {
  const days: SlotDay[] = [];
  const byKey = new Map<string, SlotDay>();
  for (const slot of slots) {
    const key = localDayKey(new Date(slot.startsAt));
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
