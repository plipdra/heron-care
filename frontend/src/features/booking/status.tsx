import type { BookingStatus } from './api';

// Display state is DERIVED, not the raw status: a CONFIRMED booking whose end
// time has passed is "ended" (no job marks it COMPLETED yet), and never
// joinable. Classification is a pure epoch compare (UTC instant vs Date.now());
// the datetime helpers are for display only. Shared by the patient and doctor
// appointment pages so they can never classify the same booking differently.
export type DisplayStatus = 'upcoming' | 'ended' | 'completed' | 'cancelled';

// Accepts any object with a status + end time, so both PatientBooking and
// DoctorBooking satisfy it without either importing the other.
export function displayStatus(
  booking: { status: BookingStatus; endsAt: string },
  now: number,
): DisplayStatus {
  if (booking.status === 'CANCELLED') return 'cancelled';
  if (booking.status === 'COMPLETED') return 'completed';
  return new Date(booking.endsAt).getTime() > now ? 'upcoming' : 'ended';
}

// Calm, state-only chips. Confirmed leans on the primary tint; completed uses a
// derived shade of the sanctioned sage success; ended/cancelled stay neutral —
// no alarm colour, since neither is an error (cancelling is a normal action).
const STATUS_META: Record<DisplayStatus, { label: string; chip: string; dot: string }> = {
  upcoming: {
    label: 'Confirmed',
    chip: 'border-primary-tint-md bg-primary-tint-sm text-primary',
    dot: 'bg-primary',
  },
  completed: {
    label: 'Completed',
    chip: 'border-[rgba(123,155,126,0.35)] bg-[rgba(123,155,126,0.14)] text-[#4F6B52]',
    dot: 'bg-success',
  },
  ended: {
    label: 'Ended',
    chip: 'border-line bg-surface-raised text-ink-muted',
    dot: 'bg-ink-muted',
  },
  cancelled: {
    label: 'Cancelled',
    chip: 'border-line bg-surface-raised text-ink-muted',
    dot: 'bg-ink-muted',
  },
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
