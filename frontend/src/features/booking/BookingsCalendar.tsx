import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/datetime';

export type CalendarEvent = {
  id: string;
  startsAt: string;
  title: string;
  // Visual tone, mapped to the calm state palette. live = sage 'care' (in-progress
  // now); done/ended muted navy; cancelled neutral. Never alarm colour.
  tone: 'live' | 'confirmed' | 'completed' | 'ended' | 'cancelled';
  onClick?: () => void;
};

const TONE: Record<CalendarEvent['tone'], string> = {
  live: 'border-care-line bg-care-tint text-care',
  confirmed: 'border-primary-tint-md bg-primary-tint-sm text-primary',
  completed: 'border-line bg-primary-tint-sm text-ink-muted',
  ended: 'border-line bg-surface-raised text-ink-muted',
  cancelled: 'border-line bg-surface-raised text-ink-muted line-through',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Monday-first index (0 = Mon … 6 = Sun) for a date's weekday.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// A calm month calendar over a set of bookings — a deliberate complement to the
// list view, not a replacement. Slots are server-derived elsewhere; this view is
// read-only orientation: which days have consults, at a glance. Days outside the
// month are muted; today carries a quiet ring; events render as state-toned chips.
export function BookingsCalendar({ events }: { events: CalendarEvent[] }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = new Date(e.startsAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [events]);

  // 6 weeks (42 cells) from the Monday on/Before the 1st — a stable grid height.
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayIndex(first));
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="tabular text-lg font-semibold text-primary-800">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(today))}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-md border border-line bg-line">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-surface-raised py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
          >
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = sameDay(date, today);
          const dayEvents = byDay.get(date.toDateString()) ?? [];
          return (
            <div
              key={date.toISOString()}
              className={`min-h-[88px] bg-surface p-1.5 ${inMonth ? '' : 'bg-bg'}`}
            >
              <div className="flex justify-end">
                <span
                  className={`tabular flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : inMonth
                        ? 'text-ink'
                        : 'text-ink-muted/50'
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={e.onClick}
                    title={`${formatTime(e.startsAt)} · ${e.title}`}
                    className={`tabular truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium ${TONE[e.tone]} ${e.onClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                  >
                    {formatTime(e.startsAt)} {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="px-1.5 text-[11px] text-ink-muted">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
