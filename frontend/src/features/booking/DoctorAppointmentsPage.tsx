import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { MeetingLinkActions } from '@/components/shared/MeetingLinkActions';
import {
  deriveAge,
  formatDate,
  formatFullDateTime,
  localTimeZoneLabel,
} from '@/lib/datetime';
import { useNow } from '@/lib/useNow';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import { StatusPill, displayStatus } from './status';
import { ConsultationSummaryDialog } from './ConsultationSummaryDialog';
import { WriteConsultationNotesDialog } from './WriteConsultationNotesDialog';
import { useDoctorBookings, usePatientContext, type DoctorBooking } from './api';

// A labelled value in the patient-details block. Present values render in ink
// with tabular figures (so columns of vitals don't jitter); a blank field reads
// a calm muted "Not provided", never an alarm color or an empty gap.
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={value ? 'tabular text-sm text-ink' : 'text-sm text-ink-muted'}>
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

// One care list (conditions / allergies / medications). Health-data entries, so
// chip text is ink over a faint blue tint — never colour-coded. Null/empty shows
// the calm empty line so a blank section still reads as deliberate.
function CareList({
  label,
  items,
  empty,
}: {
  label: string;
  items: string[] | null;
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {items && items.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="inline-flex items-center rounded-full border border-line bg-primary-tint-sm px-2.5 py-0.5 text-xs font-medium text-ink"
            >
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

// The doctor's pre-consult read of one patient. The booking fields (name, time,
// concern, join link) come from the already-loaded list row; the medical context
// (vitals, history) is fetched only now, on open.
function PatientContextDialog({
  booking,
  onClose,
}: {
  booking: DoctorBooking;
  onClose: () => void;
}) {
  const { data: context, isPending, isError } = usePatientContext(booking.id, true);
  const status = displayStatus(booking, Date.now());
  const tzLabel = localTimeZoneLabel();
  // The patient's chosen avatar — visible to the doctor for this booking only
  // (fetched with the doctor's token; falls back to initials when unset).
  const patientPhoto = useAuthedImageUrl(`/api/profile-pictures/${booking.patientUserId}`);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={booking.patientName ?? '?'} photoUrl={patientPhoto} size={48} />
            <div>
              <DialogTitle>{booking.patientName ?? 'Patient'}</DialogTitle>
              <div className="mt-1">
                <StatusPill status={status} />
              </div>
            </div>
          </div>
          <DialogDescription>
            <span className="tabular text-ink">{formatFullDateTime(booking.startsAt)}</span>
            {' · '}Times shown in your local time ({tzLabel}).
          </DialogDescription>
        </DialogHeader>

        {status === 'upcoming' && booking.meetingLink && (
          <div className="flex flex-col gap-2">
            <MeetingLinkActions link={booking.meetingLink} label="Join the consult" />
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-ink-muted">What the patient told you</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
            {booking.concernNote ?? (
              <span className="text-ink-muted">The patient didn’t add a note.</span>
            )}
          </p>
        </div>

        {isPending && (
          <div className="flex justify-center py-6">
            <CrescentSpinner size={32} />
          </div>
        )}

        {isError && (
          <p className="text-sm text-ink-muted">
            Couldn’t load this patient’s details. Check your connection, then close and reopen this panel.
          </p>
        )}

        {context && (
          <>
            <div className="flex flex-col gap-4">
              <CareList
                label="Conditions"
                items={context.conditions}
                empty="No conditions shared."
              />
              <CareList
                label="Allergies"
                items={context.allergies}
                empty="No known allergies shared."
              />
              <CareList
                label="Current medications"
                items={context.medications}
                empty="No current medications shared."
              />
              {context.notesForDoctor && (
                <div>
                  <p className="text-xs font-medium text-ink-muted">Notes for you</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                    {context.notesForDoctor}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-ink-muted">Patient details</p>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Sex" value={context.sexLabel} />
                <Field
                  label="Age"
                  value={context.birthday ? `${deriveAge(context.birthday)} years` : null}
                />
                <Field
                  label="Born"
                  value={context.birthday ? formatDate(context.birthday) : null}
                />
                <Field
                  label="Weight"
                  value={context.weightKg != null ? `${context.weightKg} kg` : null}
                />
                <Field
                  label="Height"
                  value={context.heightCm != null ? `${context.heightCm} cm` : null}
                />
                <div>
                  <p className="text-xs font-medium text-ink-muted">Contact</p>
                  {context.contactNumber ? (
                    <a
                      href={`tel:${context.contactNumber}`}
                      className="tabular text-sm text-primary hover:underline"
                    >
                      {context.contactNumber}
                    </a>
                  ) : (
                    <p className="text-sm text-ink-muted">Not provided</p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-ink-muted">Shared in confidence for this consultation.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DoctorAppointmentCard({
  booking,
  now,
  onViewContext,
  onWriteNotes,
  onViewNotes,
}: {
  booking: DoctorBooking;
  now: number;
  onViewContext: () => void;
  onWriteNotes: () => void;
  onViewNotes: () => void;
}) {
  const status = displayStatus(booking, now);
  const isPast = status !== 'upcoming';
  const patientPhoto = useAuthedImageUrl(`/api/profile-pictures/${booking.patientUserId}`);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={booking.patientName ?? '?'} photoUrl={patientPhoto} size={48} />
            <div>
              <h3 className="text-lg font-semibold leading-tight">
                {booking.patientName ?? 'Patient'}
              </h3>
              <p className="mt-1 tabular text-sm text-ink-muted">
                {formatFullDateTime(booking.startsAt, isPast)}
              </p>
              {booking.rescheduledFrom && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  Rescheduled from{' '}
                  <span className="tabular">{formatFullDateTime(booking.rescheduledFrom)}</span>
                </p>
              )}
            </div>
          </div>
          <StatusPill status={status} />
        </div>

        {booking.concernNote && (
          <div className="mt-4">
            <p className="text-xs font-medium text-ink-muted">What the patient told you</p>
            <p className="mt-1 line-clamp-2 text-sm text-ink">{booking.concernNote}</p>
          </div>
        )}

        {status === 'cancelled' ? (
          // A cancelled consult intentionally stops exposing the patient's
          // medical context (the context endpoint returns 404 for it), so we
          // don't offer a "View patient details" button that's guaranteed to
          // fail — just a calm note that the patient called it off.
          <p className="mt-4 text-sm text-ink-muted">
            The patient cancelled this consultation.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onViewContext}>
              View patient details
            </Button>
            {status === 'upcoming' && booking.meetingLink && (
              <Button asChild>
                <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
                  Join the consult
                </a>
              </Button>
            )}
            {status === 'ended' && (
              <Button onClick={onWriteNotes}>
                {booking.hasDraft ? 'Continue notes' : 'Write consultation notes'}
              </Button>
            )}
            {status === 'completed' && (
              <Button variant="secondary" onClick={onViewNotes}>
                View notes
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DoctorAppointmentsPage() {
  const { data, isPending, isError, refetch } = useDoctorBookings();
  const tzLabel = localTimeZoneLabel();
  const now = useNow();
  const [selected, setSelected] = useState<DoctorBooking | null>(null);
  const [writingNotes, setWritingNotes] = useState<DoctorBooking | null>(null);
  const [viewingNotes, setViewingNotes] = useState<DoctorBooking | null>(null);

  const header = (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight">Your schedule</h1>
      <p className="mt-2 text-ink-muted">
        The patients you’re seeing, and the visits you’ve completed.
      </p>
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
            We couldn’t load your schedule. Check your connection — we’ll keep trying.
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
          <p className="text-lg font-medium">No consultations booked yet.</p>
          <p className="mt-2 text-ink-muted">
            When a patient books with you, they’ll appear here with the details you need
            before the visit.
          </p>
        </div>
      </main>
    );
  }

  const upcoming = items
    .filter((b) => displayStatus(b, now) === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
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
              <DoctorAppointmentCard
                key={b.id}
                booking={b}
                now={now}
                onViewContext={() => setSelected(b)}
                onWriteNotes={() => setWritingNotes(b)}
                onViewNotes={() => setViewingNotes(b)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">No upcoming consultations.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Past</h2>
        {past.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {past.map((b) => (
              <DoctorAppointmentCard
                key={b.id}
                booking={b}
                now={now}
                onViewContext={() => setSelected(b)}
                onWriteNotes={() => setWritingNotes(b)}
                onViewNotes={() => setViewingNotes(b)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            Your completed and cancelled consultations will appear here.
          </p>
        )}
        {truncated && (
          <p className="mt-4 text-xs text-ink-muted">
            Showing your 50 most recent consultations.
          </p>
        )}
      </section>

      {selected && (
        <PatientContextDialog booking={selected} onClose={() => setSelected(null)} />
      )}
      {writingNotes && (
        <WriteConsultationNotesDialog
          booking={writingNotes}
          onClose={() => setWritingNotes(null)}
        />
      )}
      {viewingNotes && (
        <ConsultationSummaryDialog
          bookingId={viewingNotes.id}
          heading={viewingNotes.patientName ?? 'Patient'}
          onClose={() => setViewingNotes(null)}
        />
      )}
    </main>
  );
}
