import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { localTimeZoneLabel } from '@/lib/datetime';
import { useAuth } from '@/features/auth/AuthContext';
import { useDoctorSlots, type Slot } from './api';
import { SlotPicker } from './SlotPicker';
import { BookingDialog } from './BookingDialog';
import { setDraft, takeDraftFor } from './draftStore';

type AvailabilityCardProps = {
  doctorProfileId: string;
  doctorUserId: string;
  doctorName: string;
  specializationLabel: string | null;
};

// Hosts the booking flow on the doctor profile. Guests browse and select; auth
// is required only at commitment (the draft handoff carries the selection
// across login). The slot list is public, so it loads the same for everyone.
export function AvailabilityCard({
  doctorProfileId,
  doctorUserId,
  doctorName,
  specializationLabel,
}: AvailabilityCardProps) {
  const { isAuthenticated, user, openAuthModal } = useAuth();
  const { data: slots, isPending, isError } = useDoctorSlots(doctorProfileId);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [resumedNote, setResumedNote] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const tzLabel = localTimeZoneLabel();
  const isDoctor = isAuthenticated && user?.role === 'DOCTOR';

  // Resume the handoff: once authenticated, reclaim any draft left for this
  // doctor and reopen the confirmation. takeDraftFor consumes the draft, so
  // this fires at most once per stored draft.
  useEffect(() => {
    if (!isAuthenticated) return;
    const draft = takeDraftFor(doctorProfileId);
    if (!draft) return;
    setSelectedSlot({ startsAt: draft.startsAt, endsAt: draft.endsAt });
    setResumedNote(draft.concernNote);
    setDialogOpen(true);
  }, [isAuthenticated, doctorProfileId]);

  function handleBookClick() {
    if (!selectedSlot) return;
    if (!isAuthenticated) {
      // Stash the selection (no identity, no idempotency key) and send the
      // guest through auth; the resume effect picks it back up after login.
      setDraft({
        doctorProfileId,
        doctorUserId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        concernNote: '',
      });
      openAuthModal('booking');
      return;
    }
    setResumedNote('');
    setDialogOpen(true);
  }

  return (
    <Card className="mt-8 shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-primary-800">Availability</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Times shown in {tzLabel}.
        </p>

        {isPending && (
          <div className="flex justify-center py-12">
            <CrescentSpinner size={48} />
          </div>
        )}

        {isError && (
          <p className="mt-6 text-sm text-ink-muted">
            Couldn’t load available times. Check your connection — we’ll keep trying.
          </p>
        )}

        {slots && slots.length === 0 && (
          <div className="mt-6 rounded-lg border border-line bg-surface p-8 text-center">
            <p className="text-lg font-medium">No open times right now.</p>
            <p className="mt-2 text-ink-muted">
              {doctorName} hasn’t published availability for the next two weeks. Check
              back soon, or browse other specialists.
            </p>
            <Button variant="secondary" asChild className="mt-6">
              <Link to="/doctors">Back to all doctors</Link>
            </Button>
          </div>
        )}

        {slots && slots.length > 0 && (
          <div className="mt-6">
            <SlotPicker
              slots={slots}
              selectedStartsAt={selectedSlot?.startsAt ?? null}
              onSelect={setSelectedSlot}
            />

            <div className="mt-6">
              {isDoctor ? (
                <p className="text-sm text-ink-muted">
                  Booking is available to patient accounts.
                </p>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full shadow-sm sm:w-auto"
                    onClick={handleBookClick}
                    disabled={!selectedSlot}
                  >
                    Book this time
                  </Button>
                  {!selectedSlot && (
                    <p className="mt-2 text-xs text-ink-muted">
                      Select a time to continue.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {selectedSlot && dialogOpen && (
        <BookingDialog
          key={selectedSlot.startsAt}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialSlot={selectedSlot}
          initialConcernNote={resumedNote}
          doctorName={doctorName}
          doctorUserId={doctorUserId}
          specializationLabel={specializationLabel}
        />
      )}
    </Card>
  );
}
