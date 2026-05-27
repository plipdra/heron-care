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
import { formatDate } from '@/lib/datetime';
import { useConsultationNotes } from './api';

// One read-only section of the summary. Renders nothing when empty so the
// summary stays clean (no rows of "not recorded").
function Section({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{text}</p>
    </div>
  );
}

// Read-only consultation summary, shared by the patient (their visit) and the
// doctor (reading back their own finalized notes). Lazy-fetches the record only
// when opened. Leads with the conclusion (assessment / plan / prescription),
// then the supporting subjective/objective.
export function ConsultationSummaryDialog({
  bookingId,
  heading,
  onClose,
}: {
  bookingId: string;
  heading: string;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useConsultationNotes(bookingId, true);

  const isEmpty =
    data &&
    !data.assessment &&
    !data.plan &&
    !data.subjective &&
    !data.objective &&
    data.prescription.length === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consultation summary</DialogTitle>
          <DialogDescription>{heading}</DialogDescription>
        </DialogHeader>

        {isPending && (
          <div className="flex justify-center py-8">
            <CrescentSpinner size={32} />
          </div>
        )}

        {isError && (
          <p className="text-sm text-ink-muted">
            Couldn’t load this consultation summary. Close and try again.
          </p>
        )}

        {data && (
          <>
            <Section label="Assessment" text={data.assessment} />
            <Section label="Plan" text={data.plan} />

            <div>
              <p className="text-xs font-medium text-ink-muted">Prescription</p>
              {data.prescription.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {data.prescription.map((item, i) => (
                    <div key={i} className="rounded-md border border-line p-3">
                      <p className="text-sm font-medium text-ink">{item.medication}</p>
                      {item.dosage && <p className="tabular text-sm text-ink">{item.dosage}</p>}
                      {item.instructions && (
                        <p className="mt-0.5 text-sm text-ink-muted">{item.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">
                  No medication was prescribed at this visit.
                </p>
              )}
            </div>

            <Section label="Subjective" text={data.subjective} />
            <Section label="Objective" text={data.objective} />

            {isEmpty && (
              <p className="text-sm text-ink-muted">
                This visit was finalized without notes.
              </p>
            )}

            {data.finalizedAt && (
              <p className="text-xs text-ink-muted">
                {heading} · finalised on {formatDate(data.finalizedAt)}.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
