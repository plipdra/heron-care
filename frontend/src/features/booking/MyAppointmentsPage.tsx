import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { MeetingLinkActions } from '@/components/shared/MeetingLinkActions';
import { formatFullDateTime, localTimeZoneLabel } from '@/lib/datetime';
import { useMyBookings, type PatientBooking } from './api';
import { StatusPill, displayStatus } from './status';
import { ConsultationSummaryDialog } from './ConsultationSummaryDialog';

function AppointmentCard({
  booking,
  now,
  onViewSummary,
}: {
  booking: PatientBooking;
  now: number;
  onViewSummary: () => void;
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

        {booking.concernNote && (
          <div className="mt-4">
            <p className="text-xs font-medium text-ink-muted">What you told your doctor</p>
            <p className="mt-1 line-clamp-3 text-sm text-ink">{booking.concernNote}</p>
          </div>
        )}

        {status === 'upcoming' &&
          (booking.meetingLink ? (
            <div className="mt-4 flex flex-col gap-2">
              <MeetingLinkActions link={booking.meetingLink} />
              <p className="text-xs text-ink-muted">This link opens your video room.</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              Your doctor will share the video link before your appointment.
            </p>
          ))}

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
  const now = Date.now();
  const [viewingSummary, setViewingSummary] = useState<PatientBooking | null>(null);

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

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      {header}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {upcoming.map((b) => (
              <AppointmentCard
                key={b.id}
                booking={b}
                now={now}
                onViewSummary={() => setViewingSummary(b)}
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

      {viewingSummary && (
        <ConsultationSummaryDialog
          bookingId={viewingSummary.id}
          heading={`With ${viewingSummary.doctorName ?? 'your doctor'}`}
          onClose={() => setViewingSummary(null)}
        />
      )}
    </main>
  );
}
