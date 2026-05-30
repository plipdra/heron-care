import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { MeetingLinkActions } from '@/components/shared/MeetingLinkActions';
import { ApiError } from '@/lib/api';
import { formatFullDateTime, localTimeZoneLabel } from '@/lib/datetime';
import { useNow } from '@/lib/useNow';
import { ProfileCompletionNudge } from '@/features/patient/ProfileCompletionNudge';
import { useCancelBooking, useMyBookings, type PatientBooking } from './api';
import { BookingsCalendar, type CalendarEvent } from './BookingsCalendar';
import { BookingsWeek } from './BookingsWeek';
import { AppointmentViewToggle, type ApptView } from './AppointmentViewToggle';
import { BookingEventDialog } from './BookingEventDialog';

const TONE_FOR: Record<string, CalendarEvent['tone']> = {
  upcoming: 'confirmed',
  completed: 'completed',
  ended: 'ended',
  cancelled: 'cancelled',
};

import { StatusPill, displayStatus } from './status';
import { ConsultationSummaryDialog } from './ConsultationSummaryDialog';
import { RescheduleDialog } from './RescheduleDialog';

// Confirm step for cancelling. Calm, not alarmed: cancelling a telehealth visit
// is routine, so no danger-red framing — red is reserved for an actual request
// failure. The buttons avoid the "Cancel" verb collision (which would mean both
// "abort this dialog" and "cancel the booking"): the dismiss action reads "Keep
// appointment", the destructive one "Cancel appointment".
function CancelAppointmentDialog({
  booking,
  onClose,
  onCancelled,
}: {
  booking: PatientBooking;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const cancel = useCancelBooking();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await cancel.mutateAsync({
        bookingId: booking.id,
        doctorProfileId: booking.doctorProfileId,
      });
      onCancelled();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? 'Your appointment wasn’t cancelled — please try once more.'
          : 'Couldn’t reach the server. Check your connection and try again.',
      );
    }
  }

  const submitting = cancel.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            Your{' '}
            <span className="tabular text-ink">{formatFullDateTime(booking.startsAt)}</span>
            {booking.doctorName ? ` visit with ${booking.doctorName}` : ' visit'} will be
            cancelled and the time freed up. You can book again whenever you’re ready.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-danger">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep appointment
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={submitting}>
            {submitting ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentCard({
  booking,
  now,
  onViewSummary,
  onReschedule,
  onCancel,
}: {
  booking: PatientBooking;
  now: number;
  onViewSummary: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const status = displayStatus(booking, now);
  const isPast = status !== 'upcoming';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={booking.doctorName ?? '?'} size={48} />
            <div>
              <h3 className="text-lg font-semibold leading-tight">
                {booking.doctorProfileId && booking.doctorName ? (
                  <Link to={`/doctors/${booking.doctorProfileId}`} className="hover:text-primary">
                    {booking.doctorName}
                  </Link>
                ) : (
                  booking.doctorName ?? 'Doctor unavailable'
                )}
              </h3>
              {booking.doctorSpecializationLabel && (
                <Badge className="mt-1.5">{booking.doctorSpecializationLabel}</Badge>
              )}
            </div>
          </div>
          <StatusPill status={status} />
        </div>

        <p className="mt-4 tabular font-medium text-ink">
          {formatFullDateTime(booking.startsAt, isPast)}
        </p>
        {booking.rescheduledFrom && (
          <p className="mt-1 text-xs text-ink-muted">
            Rescheduled from{' '}
            <span className="tabular">{formatFullDateTime(booking.rescheduledFrom)}</span>
          </p>
        )}

        {booking.concernNote && (
          <div className="mt-4">
            <p className="text-xs font-medium text-ink-muted">What you told your doctor</p>
            <p className="mt-1 line-clamp-3 text-sm text-ink">{booking.concernNote}</p>
          </div>
        )}

        {status === 'upcoming' && (
          <>
            {booking.meetingLink ? (
              <div className="mt-4 flex flex-col gap-2">
                <MeetingLinkActions link={booking.meetingLink} />
                <p className="text-xs text-ink-muted">This link opens your video room.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">
                Your doctor will share the video link before your appointment.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {booking.doctorProfileId && (
                <Button variant="secondary" size="sm" onClick={onReschedule}>
                  Reschedule
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel appointment
              </Button>
            </div>
          </>
        )}

        {status === 'ended' && (
          <p className="mt-4 text-sm text-ink-muted">This appointment has ended.</p>
        )}

        {status === 'completed' && (
          <div className="mt-4">
            <Button variant="secondary" onClick={onViewSummary}>
              View consultation summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MyAppointmentsPage() {
  const { data, isPending, isError, refetch } = useMyBookings();
  const tzLabel = localTimeZoneLabel();
  const now = useNow();
  const [viewingSummary, setViewingSummary] = useState<PatientBooking | null>(null);
  const [rescheduling, setRescheduling] = useState<PatientBooking | null>(null);
  const [cancelling, setCancelling] = useState<PatientBooking | null>(null);
  const [view, setView] = useState<ApptView>('list');
  const [eventBooking, setEventBooking] = useState<PatientBooking | null>(null);
  // Explicit confirmation after a cancel/reschedule. The mutation closes its
  // dialog and the list re-renders, but a cancelled card slips into Past out of
  // view, so a silent close reads as "did it work?" — this banner answers that.
  const [confirmation, setConfirmation] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmation) return;
    const id = setTimeout(() => setConfirmation(null), 6000);
    return () => clearTimeout(id);
  }, [confirmation]);

  const header = (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight">Your appointments</h1>
      <p className="mt-2 text-ink-muted">Join your upcoming visits and review past care.</p>
      <p className="mt-1 text-xs text-ink-muted">
        Times shown in your local time ({tzLabel}).
      </p>
    </header>
  );

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={64} />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        {header}
        <div className="mt-10 rounded-lg border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink-muted">
            We couldn’t load your appointments. Check your connection — we’ll keep trying.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  const items = data.content;

  if (items.length === 0) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        {header}
        <ProfileCompletionNudge />
        <div className="mt-10 rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-lg font-medium">No appointments yet.</p>
          <p className="mt-2 text-ink-muted">
            Once you book a consultation, you’ll join it and review it here.
          </p>
          <Button asChild className="mt-6">
            <Link to="/doctors">Find a doctor</Link>
          </Button>
        </div>
      </main>
    );
  }

  const upcoming = items
    .filter((b) => displayStatus(b, now) === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  // Past keeps the server's most-recent-first order.
  const past = items.filter((b) => displayStatus(b, now) !== 'upcoming');
  const truncated = data.totalElements > items.length;

  // Calendar events from the same list — completed visits open their summary.
  const events: CalendarEvent[] = items.map((b) => ({
    id: b.id,
    startsAt: b.startsAt,
    title: b.doctorName ?? 'Doctor',
    tone: TONE_FOR[displayStatus(b, now)],
    onClick: () => setEventBooking(b),
  }));

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      {header}

      <ProfileCompletionNudge />

      {confirmation && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink"
        >
          <Check className="h-4 w-4 shrink-0 text-success" />
          <span>{confirmation}</span>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <AppointmentViewToggle view={view} onChange={setView} />
      </div>

      {view === 'month' ? (
        <div className="mt-4">
          <BookingsCalendar events={events} />
        </div>
      ) : view === 'week' ? (
        <div className="mt-4">
          <BookingsWeek events={events} />
        </div>
      ) : (
        <>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {upcoming.map((b) => (
              <AppointmentCard
                key={b.id}
                booking={b}
                now={now}
                onViewSummary={() => setViewingSummary(b)}
                onReschedule={() => setRescheduling(b)}
                onCancel={() => setCancelling(b)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            No upcoming appointments.{' '}
            <Link to="/doctors" className="text-primary hover:underline">
              Find a doctor
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Past</h2>
        {past.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {past.map((b) => (
              <AppointmentCard
                key={b.id}
                booking={b}
                now={now}
                onViewSummary={() => setViewingSummary(b)}
                onReschedule={() => setRescheduling(b)}
                onCancel={() => setCancelling(b)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            Your completed and cancelled visits will appear here.
          </p>
        )}
        {truncated && (
          <p className="mt-4 text-xs text-ink-muted">
            Showing your 50 most recent appointments.
          </p>
        )}
      </section>
        </>
      )}

      {eventBooking && (
        <BookingEventDialog
          name={eventBooking.doctorName ?? 'Your doctor'}
          badge={
            eventBooking.doctorSpecializationLabel ? (
              <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent-tint px-2.5 py-0.5 text-xs font-semibold text-accent-deep">
                {eventBooking.doctorSpecializationLabel}
              </span>
            ) : undefined
          }
          startsAt={eventBooking.startsAt}
          status={displayStatus(eventBooking, now)}
          concern={eventBooking.concernNote}
          concernLabel="What you told your doctor"
          joinable={eventBooking.joinable}
          meetingLink={eventBooking.meetingLink}
          onClose={() => setEventBooking(null)}
          actions={
            <>
              {displayStatus(eventBooking, now) === 'upcoming' && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRescheduling(eventBooking);
                      setEventBooking(null);
                    }}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCancelling(eventBooking);
                      setEventBooking(null);
                    }}
                  >
                    Cancel appointment
                  </Button>
                </>
              )}
              {displayStatus(eventBooking, now) === 'completed' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setViewingSummary(eventBooking);
                    setEventBooking(null);
                  }}
                >
                  View summary
                </Button>
              )}
            </>
          }
        />
      )}

      {viewingSummary && (
        <ConsultationSummaryDialog
          bookingId={viewingSummary.id}
          heading={`With ${viewingSummary.doctorName ?? 'your doctor'}`}
          onClose={() => setViewingSummary(null)}
          documentsBookingId={viewingSummary.id}
        />
      )}
      {rescheduling && (
        <RescheduleDialog
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onRescheduled={(newStartsAt) => {
            setConfirmation(`Appointment moved to ${formatFullDateTime(newStartsAt)}.`);
            setRescheduling(null);
          }}
        />
      )}
      {cancelling && (
        <CancelAppointmentDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setConfirmation(
              cancelling.doctorName
                ? `Your appointment with ${cancelling.doctorName} was cancelled.`
                : 'Your appointment was cancelled.',
            );
            setCancelling(null);
          }}
        />
      )}
    </main>
  );
}
