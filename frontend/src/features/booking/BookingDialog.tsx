import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/Avatar';
import { MeetingLinkActions } from '@/components/shared/MeetingLinkActions';
import { ApiError } from '@/lib/api';
import { formatDayChip, formatFullDateTime, formatTime, localTimeZoneLabel } from '@/lib/datetime';
import {
  extractAlternatives,
  useCreateBooking,
  type BookingResponse,
  type Slot,
} from './api';

type BookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSlot: Slot;
  initialConcernNote?: string;
  doctorName: string;
  doctorUserId: string;
  specializationLabel: string | null;
  onBooked?: () => void;
};

type View = 'confirm' | 'conflict' | 'success';

const MAX_NOTE = 1000;

// Owns the booking commitment: confirm -> (success | conflict). All three views
// render inside one Dialog so the patient's attention never scatters (no toast).
// Remounted by the parent (keyed on the picked slot) so each fresh selection
// starts clean; alternative-slot rebooks mutate state in place.
export function BookingDialog({
  open,
  onOpenChange,
  initialSlot,
  initialConcernNote = '',
  doctorName,
  doctorUserId,
  specializationLabel,
  onBooked,
}: BookingDialogProps) {
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();

  const [targetSlot, setTargetSlot] = useState<Slot>(initialSlot);
  const [concernNote, setConcernNote] = useState(initialConcernNote);
  const [view, setView] = useState<View>('confirm');
  const [alternatives, setAlternatives] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tzLabel = localTimeZoneLabel();

  // Idempotency-Key lifecycle. The key stays stable while the request body
  // (slot + note) is unchanged, so a retry after flaky wifi replays the
  // original booking instead of creating a second. The moment the body
  // changes — a different slot, an edited note — we mint a new key. Because the
  // key is derived from exactly the body we send, "same key, different body"
  // (the server's 422 case) is unreachable from this UI.
  const idemKeyRef = useRef<string | null>(null);
  const bodySigRef = useRef<string | null>(null);
  function keyFor(slot: Slot, note: string): string {
    const sig = `${slot.startsAt}\u0000${note}`;
    if (!idemKeyRef.current || sig !== bodySigRef.current) {
      idemKeyRef.current = crypto.randomUUID();
      bodySigRef.current = sig;
    }
    return idemKeyRef.current;
  }

  async function submit(slot: Slot) {
    const note = concernNote.trim();
    setSubmitError(null);
    setTargetSlot(slot);
    setView('confirm');
    try {
      const result = await createBooking.mutateAsync({
        body: { doctorUserId, startsAt: slot.startsAt, concernNote: note || undefined },
        idempotencyKey: keyFor(slot, note),
      });
      setBooking(result);
      setView('success');
      onBooked?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The snapshot we booked against was stale; refresh it behind the modal.
        queryClient.invalidateQueries({ queryKey: ['doctor-slots'] });
        setAlternatives(extractAlternatives(err));
        setView('conflict');
        return;
      }
      setSubmitError(
        err instanceof ApiError
          ? err.problem?.detail ?? 'Your booking didn’t save — the slot may have just been taken. Try another time.'
          : 'Your booking didn’t save — couldn’t reach the server. Check your connection and try again.',
      );
    }
  }

  const submitting = createBooking.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {view === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm your booking</DialogTitle>
              <DialogDescription>Review the details before you book.</DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-md border border-line p-3">
              <Avatar name={doctorName} size={48} />
              <div>
                <p className="font-semibold leading-tight">{doctorName}</p>
                {specializationLabel && (
                  <Badge className="mt-1.5">{specializationLabel}</Badge>
                )}
              </div>
            </div>

            <div>
              <p className="tabular font-medium text-ink">
                {formatFullDateTime(targetSlot.startsAt)}
              </p>
              <p className="text-xs text-ink-muted">
                Times shown in your local time ({tzLabel}).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="concern-note" className="text-sm font-medium text-ink">
                What brings you in? <span className="text-ink-muted">(optional)</span>
              </label>
              <textarea
                id="concern-note"
                rows={4}
                maxLength={MAX_NOTE}
                value={concernNote}
                onChange={(e) => setConcernNote(e.target.value)}
                placeholder="e.g. what you're feeling, when it started, anything you've tried."
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              />
              <p className="flex justify-between text-xs text-ink-muted">
                <span>A short note helps your doctor prepare.</span>
                <span className="tabular">
                  {concernNote.length} / {MAX_NOTE}
                </span>
              </p>
            </div>

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={() => submit(targetSlot)} disabled={submitting}>
                {submitting ? 'Booking…' : 'Confirm booking'}
              </Button>
            </DialogFooter>
          </>
        )}

        {view === 'conflict' && (
          <>
            <DialogHeader>
              <DialogTitle>That slot was just taken.</DialogTitle>
              <DialogDescription>
                {alternatives.length > 0
                  ? `Here are the nearest open times with ${doctorName}.`
                  : 'There are no other open times right now. Check back soon.'}
              </DialogDescription>
            </DialogHeader>

            {alternatives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alternatives.map((alt) => (
                  <button
                    key={alt.startsAt}
                    type="button"
                    onClick={() => submit(alt)}
                    disabled={submitting}
                    className="tabular rounded-md border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-primary disabled:opacity-50"
                  >
                    {formatDayChip(alt.startsAt).weekday} · {formatTime(alt.startsAt)}
                  </button>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Back to all times
              </Button>
            </DialogFooter>
          </>
        )}

        {view === 'success' && booking && (
          <>
            <DialogHeader>
              <DialogTitle>You’re booked.</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3">
              <Avatar name={doctorName} size={48} />
              <div>
                <p className="font-semibold leading-tight">{doctorName}</p>
                {specializationLabel && (
                  <Badge className="mt-1.5">{specializationLabel}</Badge>
                )}
              </div>
            </div>

            <div>
              <p className="tabular font-medium text-ink">
                {formatFullDateTime(booking.startsAt)}
              </p>
              <p className="text-sm text-ink-muted">A reminder will arrive an hour before.</p>
            </div>

            {booking.meetingLink ? (
              <div className="flex flex-col gap-2">
                <MeetingLinkActions link={booking.meetingLink} />
                <p className="text-xs text-ink-muted">
                  This link opens your video room. Save it — you’ll use it at{' '}
                  <span className="tabular">{formatTime(booking.startsAt)}</span>.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Your doctor will share the video link before your appointment.
              </p>
            )}

            <p className="text-xs text-ink-muted">
              Find this appointment anytime under{' '}
              <Link to="/appointments" className="text-primary hover:underline">
                Appointments
              </Link>
              .
            </p>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
