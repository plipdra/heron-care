import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { formatFullDateTime, localTimeZoneLabel, timeZoneLabel } from '@/lib/datetime';
import { useDoctorBookings } from '@/features/booking/api';
import { useUpdateMyAvailability, type Availability } from './api';

const WEEKDAYS: { value: string; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

type DayState = { enabled: boolean; start: string; end: string };
type BlockState = { key: string; start: string; end: string; reason: string };

const DEFAULT_HOURS = { start: '09:00', end: '17:00' };

// "09:00:00" → "09:00" for a native time input.
const hhmm = (t: string) => t.slice(0, 5);

// An ISO instant ↔ the value a <input type="datetime-local"> expects, both in
// the browser's local wall-clock (the doctor authors time off in their own time).
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const localInputToIso = (local: string) => new Date(local).toISOString();

function emptyDays(): Record<string, DayState> {
  return Object.fromEntries(
    WEEKDAYS.map((d) => [d.value, { enabled: false, ...DEFAULT_HOURS }]),
  );
}

// The doctor's schedule + time-off authoring surface. Whole-replace: one Save
// sends the complete week and time-off list. Blocking time only stops NEW slots
// being offered — it never cancels a booking that already sits in the range, so
// we surface (not prevent) any confirmed booking a new block would overlap.
export function AvailabilityEditor({ availability }: { availability: Availability | null }) {
  const update = useUpdateMyAvailability();
  const { data: bookingsPage } = useDoctorBookings();
  // Hours belong to the doctor's practice zone, not the browser's — labelling
  // them with the browser zone (a traveling doctor, a mismatched machine) would
  // misstate the times patients are offered.
  const tzLabel = availability ? timeZoneLabel(availability.timeZone) : localTimeZoneLabel();

  const [days, setDays] = useState<Record<string, DayState>>(emptyDays);
  const [blocks, setBlocks] = useState<BlockState[]>([]);
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);

  useEffect(() => {
    if (!availability) return;
    const next = emptyDays();
    for (const entry of availability.weeklySchedule) {
      next[entry.dayOfWeek] = {
        enabled: true,
        start: hhmm(entry.startTime),
        end: hhmm(entry.endTime),
      };
    }
    setDays(next);
    setBlocks(
      availability.blockedRanges.map((r, i) => ({
        key: `existing-${i}`,
        start: isoToLocalInput(r.startsAt),
        end: isoToLocalInput(r.endsAt),
        reason: r.reason ?? '',
      })),
    );
  }, [availability]);

  const setDay = (value: string, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [value]: { ...prev[value], ...patch } }));
  const updateBlock = (key: string, patch: Partial<BlockState>) =>
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const removeBlock = (key: string) =>
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  const addBlock = () =>
    setBlocks((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, start: '', end: '', reason: '' },
    ]);

  // Confirmed, still-upcoming bookings that fall inside each edited block — shown
  // as a calm heads-up, never a hard stop. Indexed parallel to `blocks`.
  const bookings = bookingsPage?.content ?? [];
  const blockConflicts = useMemo(() => {
    const now = Date.now();
    return blocks.map((b) => {
      if (!b.start || !b.end) return [];
      const start = new Date(b.start).getTime();
      const end = new Date(b.end).getTime();
      if (!(end > start)) return [];
      return bookings.filter((bk) => {
        if (bk.status !== 'CONFIRMED') return false;
        const t = new Date(bk.startsAt).getTime();
        return t >= now && t >= start && t < end;
      });
    });
  }, [blocks, bookings]);

  async function save() {
    setFeedback(null);

    const weeklySchedule = WEEKDAYS.filter((d) => days[d.value].enabled).map((d) => ({
      dayOfWeek: d.value,
      startTime: days[d.value].start,
      endTime: days[d.value].end,
    }));
    // Client-side mirror of the server rule, for an instant, friendly message.
    const badDay = weeklySchedule.find((e) => e.endTime <= e.startTime);
    if (badDay) {
      setFeedback({
        kind: 'error',
        message: 'Each day’s end time must be later than its start time.',
      });
      return;
    }

    const incomplete = blocks.find((b) => (b.start && !b.end) || (!b.start && b.end));
    if (incomplete) {
      setFeedback({ kind: 'error', message: 'Each time-off range needs both a start and an end.' });
      return;
    }
    const blockedRanges = blocks
      .filter((b) => b.start && b.end)
      .map((b) => ({
        startsAt: localInputToIso(b.start),
        endsAt: localInputToIso(b.end),
        reason: b.reason.trim() || undefined,
      }));

    try {
      await update.mutateAsync({ weeklySchedule, blockedRanges });
      setFeedback({ kind: 'success', message: 'Your schedule is up to date.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError ? err.problem?.detail ?? err.message : 'Could not save your schedule.',
      });
    }
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Consultation hours</CardTitle>
          <CardDescription>
            The days and times you see patients. Slots are offered in 30-minute steps within
            these hours. Hours are in your practice timezone ({tzLabel}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-line">
            {WEEKDAYS.map((d) => {
              const day = days[d.value];
              return (
                <div key={d.value} className="flex items-center gap-4 py-3">
                  <label className="flex w-36 shrink-0 items-center gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) => setDay(d.value, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-line text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <span className="font-medium">{d.label}</span>
                  </label>
                  {day.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={1800}
                        aria-label={`${d.label} start time`}
                        value={day.start}
                        onChange={(e) => setDay(d.value, { start: e.target.value })}
                        className="tabular w-32"
                      />
                      <span className="text-sm text-ink-muted">to</span>
                      <Input
                        type="time"
                        step={1800}
                        aria-label={`${d.label} end time`}
                        value={day.end}
                        onChange={(e) => setDay(d.value, { end: e.target.value })}
                        className="tabular w-32"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-ink-muted">Not seeing patients</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Time off</CardTitle>
          <CardDescription>
            Block dates you're away. Patients won't be offered slots during these ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No time off scheduled. Add a range when you're away and those slots stay closed.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {blocks.map((b, i) => {
                const conflicts = blockConflicts[i] ?? [];
                return (
                  <div key={b.key} className="rounded-md border border-line p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`block-start-${b.key}`}>From</Label>
                        <Input
                          id={`block-start-${b.key}`}
                          type="datetime-local"
                          value={b.start}
                          onChange={(e) => updateBlock(b.key, { start: e.target.value })}
                          className="tabular"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`block-end-${b.key}`}>To</Label>
                        <Input
                          id={`block-end-${b.key}`}
                          type="datetime-local"
                          value={b.end}
                          onChange={(e) => updateBlock(b.key, { end: e.target.value })}
                          className="tabular"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label htmlFor={`block-reason-${b.key}`}>Reason (optional)</Label>
                        <Input
                          id={`block-reason-${b.key}`}
                          maxLength={200}
                          value={b.reason}
                          onChange={(e) => updateBlock(b.key, { reason: e.target.value })}
                          placeholder="Conference, leave…"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBlock(b.key)}
                      >
                        Remove
                      </Button>
                    </div>
                    {conflicts.length > 0 && (
                      <p className="mt-3 text-xs text-warning">
                        {conflicts.length === 1
                          ? '1 confirmed booking falls in this range'
                          : `${conflicts.length} confirmed bookings fall in this range`}
                        {' — '}
                        {conflicts
                          .slice(0, 3)
                          .map((c) => `${c.patientName ?? 'A patient'}, ${formatFullDateTime(c.startsAt)}`)
                          .join('; ')}
                        . Blocking won't cancel them — reschedule or cancel each one yourself if needed.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={addBlock}>
            Add time off
          </Button>
        </CardContent>
      </Card>

      {feedback && (
        <p
          className={`mt-4 text-sm ${
            feedback.kind === 'success' ? 'text-success' : 'text-danger'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Button className="mt-4" disabled={update.isPending} onClick={save}>
        {update.isPending ? 'Saving…' : 'Save schedule'}
      </Button>
    </>
  );
}
