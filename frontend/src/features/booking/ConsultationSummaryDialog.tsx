import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
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
  // When set (patient view), show "Download" actions that open the printable
  // visit summary / prescription in a new tab. Omitted on the doctor's side,
  // whose documents are generated from the patient's own profile data.
  documentsBookingId,
}: {
  bookingId: string;
  heading: string;
  onClose: () => void;
  documentsBookingId?: string;
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
            Couldn’t load this consultation summary. Check your connection, then close and reopen this panel.
          </p>
        )}

        {data && (
          <>
            <Section label="Assessment" text={data.assessment} />
            <Section label="Plan" text={data.plan} />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Medications prescribed
                <span className="ml-2 font-normal normal-case text-ink-muted">for your records</span>
              </p>
              {data.prescription.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-md border border-line">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-surface-raised">
                        <th className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          Medication
                        </th>
                        <th className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          Dosage
                        </th>
                        <th className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          Instructions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.prescription.map((item, i) => (
                        <tr key={i} className="align-top">
                          <td className="border-b border-line px-3 py-2 text-sm font-medium text-ink last:border-0">
                            {item.medication}
                          </td>
                          <td className="tabular border-b border-line px-3 py-2 text-sm text-ink last:border-0">
                            {item.dosage ?? '—'}
                          </td>
                          <td className="border-b border-line px-3 py-2 text-sm text-ink-muted last:border-0">
                            {item.instructions ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">
                  No medication was prescribed at this visit.
                </p>
              )}
              {data.prescription.length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">
                  This is a record of what was prescribed. To have it dispensed, download your
                  prescription and present it at any licensed pharmacy.
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

        <DialogFooter className="sm:justify-between">
          {documentsBookingId && data ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <a
                  href={`/documents/visit-summary/${documentsBookingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4" />
                  Visit summary
                </a>
              </Button>
              {data.prescription.length > 0 && (
                <Button asChild variant="secondary" size="sm" className="gap-1.5">
                  <a
                    href={`/documents/prescription/${documentsBookingId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-4 w-4" />
                    Prescription
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
