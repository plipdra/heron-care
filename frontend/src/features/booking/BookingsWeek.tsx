import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/datetime';
import type { CalendarEvent } from './BookingsCalendar';

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_PX = 52;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TONE: Record<CalendarEvent['tone'], string> = {
  confirmed: 'border-primary-tint-md bg-primary-tint-sm text-primary',
  completed: 'border-[rgba(123,155,126,0.35)] bg-[rgba(123,155,126,0.16)] text-[#4F6B52]',
  ended: 'border-line bg-surface-raised text-ink-muted',
  cancelled: 'border-line bg-surface-raised text-ink-muted line-through',
};

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

// A calm week time-grid (8am–6pm) over a set of bookings — orientation, not
// editing. Events render as state-toned blocks positioned at their start hour;
// anything outside the window clamps to the edge so nothing is silently hidden.
export function BookingsWeek({ events }: { events: CalendarEvent[] }) {
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const rangeLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="tabular text-lg font-semibold text-primary-800">{rangeLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(w.getDate() - 7); return n; })}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOf(today))}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(w.getDate() + 7); return n; })}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Day header */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-line">
            <div />
            {days.map((d) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={d.toISOString()} className="px-1 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase text-ink-muted">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </p>
                  <p
                    className={`tabular mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                      isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-ink'
                    }`}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)]">
            {/* time gutter */}
            <div>
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_PX }}>
                  <span className="tabular absolute -top-2 right-1.5 text-[10px] text-ink-muted">
                    {h % 12 === 0 ? 12 : h % 12} {h < 12 ? 'AM' : 'PM'}
                  </span>
                </div>
              ))}
            </div>
            {/* day columns */}
            {days.map((d) => {
              const dayEvents = events.filter(
                (e) => new Date(e.startsAt).toDateString() === d.toDateString(),
              );
              return (
                <div
                  key={d.toISOString()}
                  className="relative border-l border-line"
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((h) => (
                    <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }} />
                  ))}
                  {dayEvents.map((e) => {
                    const dt = new Date(e.startsAt);
                    const startDec = dt.getHours() + dt.getMinutes() / 60;
                    const top = Math.max(0, (startDec - START_HOUR) * HOUR_PX);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={e.onClick}
                        title={`${formatTime(e.startsAt)} · ${e.title}`}
                        className={`absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] font-medium leading-tight ${TONE[e.tone]} ${e.onClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                        style={{ top, minHeight: 34 }}
                      >
                        <span className="tabular block">{formatTime(e.startsAt)}</span>
                        <span className="block truncate">{e.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
