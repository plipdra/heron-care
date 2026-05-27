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

const STATUS_META: Record<DisplayStatus, { label: string; dot: string }> = {
  upcoming: { label: 'Confirmed', dot: 'bg-primary' },
  completed: { label: 'Completed', dot: 'bg-success' },
  ended: { label: 'Ended', dot: 'bg-ink-muted' },
  cancelled: { label: 'Cancelled', dot: 'bg-ink-muted' },
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
