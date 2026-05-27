import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDayChip, formatTime, groupSlotsByDay } from '@/lib/datetime';
import type { Slot } from './api';

type SlotPickerProps = {
  slots: Slot[];
  selectedStartsAt: string | null;
  onSelect: (slot: Slot) => void;
};

// Day-grouped slot list — a deliberate choice over a calendar grid. Slots
// arrive pre-filtered (no past/booked/blocked) over a two-week window, so a
// calendar's core job (disabling dates) is already done server-side. A quiet
// day selector + time grid shows only what's actionable (BRAND.md §8 — calm
// beats clever).
export function SlotPicker({ slots, selectedStartsAt, onSelect }: SlotPickerProps) {
  const days = groupSlotsByDay(slots);
  const [activeDayKey, setActiveDayKey] = useState(days[0]?.key ?? '');

  // Fall back to the first day if the active one is no longer present (e.g. its
  // last slot was just booked and the list refetched).
  const activeDay = days.find((d) => d.key === activeDayKey) ?? days[0];

  // The day row scrolls horizontally (a two-week window doesn't fit on a phone
  // or in a modal). Track whether there's hidden content on either side so the
  // chevrons advertise that the row slides — and disable a chevron at its edge.
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setEdges({
      left: scrollLeft > 1,
      right: scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, []);

  // Recompute on mount, when the set of days changes, and on resize.
  useEffect(() => {
    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [syncEdges, days.length]);

  const nudge = (direction: 1 | -1) => {
    rowRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  };

  const arrow =
    'flex w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-muted';

  return (
    <div className="min-w-0">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={!edges.left}
          aria-label="Show earlier days"
          className={arrow}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* min-w-0 lets this row shrink-and-scroll inside a grid/flex parent (the
            reschedule dialog is display:grid); without it the chips dictate the
            parent's width and overflow the modal. */}
        <div
          ref={rowRef}
          onScroll={syncEdges}
          className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth"
        >
          {days.map((day) => {
            const { weekday, day: dayNum } = formatDayChip(day.startsAt);
            const active = day.key === activeDay?.key;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setActiveDayKey(day.key)}
                className={`flex shrink-0 flex-col items-center rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-line text-ink hover:border-primary'
                }`}
              >
                <span className="font-medium">{weekday}</span>
                <span className="tabular text-lg leading-tight">{dayNum}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={!edges.right}
          aria-label="Show later days"
          className={arrow}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {activeDay?.slots.map((slot) => {
          const selected = slot.startsAt === selectedStartsAt;
          return (
            <button
              key={slot.startsAt}
              type="button"
              onClick={() => onSelect(slot)}
              className={`tabular rounded-md border px-3 py-2 text-sm transition-colors ${
                selected
                  ? 'border-primary bg-primary-tint text-primary'
                  : 'border-line text-ink hover:border-primary'
              }`}
            >
              {formatTime(slot.startsAt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
