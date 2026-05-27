import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { ApiError } from '@/lib/api';
import { formatFullDateTime, localTimeZoneLabel } from '@/lib/datetime';
import { SlotPicker } from './SlotPicker';
import {
  extractAlternatives,
  useDoctorSlots,
  useRescheduleBooking,
  type PatientBooking,
  type Slot,
} from './api';

// Moving an existing booking to a new slot. Deliberately a separate, lean dialog
// rather than a mode bolted onto BookingDialog: the concern note and doctor are
// fixed (you're not re-deciding who or why, only when), so the surface is just
// "here's your current time → pick a new one". Reuses SlotPicker and the same
// 409 alternativeSlots channel as booking. Only mounted when doctorProfileId is
// present (a since-departed doctor has no slots to offer).
export function RescheduleDialog({
  booking,
  onClose,
}: {
  booking: PatientBooking;
  onClose: () => void;
}) {
  const reschedule = useRescheduleBooking();
  const { data: slots, isPending: slotsPending } = useDoctorSlots(
    booking.doctorProfileId ?? undefined,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tzLabel = localTimeZoneLabel();

  // The picker offers only open slots, so the current slot won't appear — but
  // guard anyway: a no-op move is pointless.
  const canSubmit = picked != null && picked !== booking.startsAt;

  async function submit(startsAt: string) {
    setError(null);
    try {
      await reschedule.mutateAsync({
        bookingId: booking.id,
        startsAt,
        doctorProfileId: booking.doctorProfileId,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone took that slot first. Surface alternatives and reassure the
        // patient their existing appointment is untouched — nothing was lost.
        setAlternatives(extractAlternatives(err));
        setError('That time was just taken. Your current appointment is unchanged.');
        return;
      }
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? 'Couldn’t move your appointment. Please try again.'
          : 'Couldn’t reach the server. Please try again.',
      );
    }
  }

  const submitting = reschedule.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule your appointment</DialogTitle>
          <DialogDescription>
            Currently{' '}
            <span className="tabular text-ink">{formatFullDateTime(booking.startsAt)}</span>
            {booking.doctorName ? ` with ${booking.doctorName}` : ''}. Pick a new time below.
          </DialogDescription>
        </DialogHeader>

        {slotsPending ? (
          <div className="flex justify-center py-10">
            <CrescentSpinner size={40} />
          </div>
        ) : slots && slots.length > 0 ? (
          <>
            <SlotPicker slots={slots} selectedStartsAt={picked} onSelect={(s) => setPicked(s.startsAt)} />
            <p className="text-xs text-ink-muted">Times shown in your local time ({tzLabel}).</p>
          </>
        ) : (
          <p className="py-6 text-sm text-ink-muted">
            {booking.doctorName ?? 'This doctor'} has no open times right now. Your current
            appointment stays as it is — check back soon.
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {alternatives.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-ink">Nearest open times:</p>
            <div className="flex flex-wrap gap-2">
              {alternatives.map((alt) => (
                <button
                  key={alt.startsAt}
                  type="button"
                  onClick={() => submit(alt.startsAt)}
                  disabled={submitting}
                  className="tabular rounded-md border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-primary disabled:opacity-50"
                >
                  {formatFullDateTime(alt.startsAt)}
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep current time
          </Button>
          <Button onClick={() => picked && submit(picked)} disabled={!canSubmit || submitting}>
            {submitting ? 'Moving…' : 'Confirm new time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
