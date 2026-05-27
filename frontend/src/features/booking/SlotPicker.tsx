import { useState } from 'react';
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

  return (
    <div className="min-w-0">
      {/* min-w-0 lets this row shrink-and-scroll inside a grid/flex parent (the
          reschedule dialog is display:grid); without it the chips dictate the
          parent's width and overflow the modal. */}
      <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
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
