import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { formatFullDateTime } from '@/lib/datetime';
import { useFinalizeConsultation, type DoctorBooking } from './api';

const TEXTAREA =
  'flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

type RxRow = { id: number; medication: string; dosage: string; instructions: string };

const SOAP: { key: 'subjective' | 'objective' | 'assessment' | 'plan'; label: string; placeholder: string }[] = [
  { key: 'subjective', label: 'Subjective', placeholder: 'What the patient reports — symptoms, history, in their words.' },
  { key: 'objective', label: 'Objective', placeholder: 'What you observed — findings, vitals, examination.' },
  { key: 'assessment', label: 'Assessment', placeholder: 'Your clinical impression or diagnosis.' },
  { key: 'plan', label: 'Plan', placeholder: 'Next steps — treatment, follow-up, referrals.' },
];

// Doctor's write surface: SOAP notes + a structured prescription, finalized in
// one deliberate (confirmed) action that marks the visit complete and shares the
// record with the patient. There is no draft — finalizing is the only save, and
// it locks the record.
export function WriteConsultationNotesDialog({
  booking,
  onClose,
}: {
  booking: DoctorBooking;
  onClose: () => void;
}) {
  const finalize = useFinalizeConsultation();
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [rx, setRx] = useState<RxRow[]>([{ id: 1, medication: '', dosage: '', instructions: '' }]);
  const [nextId, setNextId] = useState(2);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRx((rows) => [...rows, { id: nextId, medication: '', dosage: '', instructions: '' }]);
    setNextId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRx((rows) => rows.filter((r) => r.id !== id));
  }
  function updateRow(id: number, field: keyof RxRow, value: string) {
    setRx((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleFinalize() {
    setError(null);
    try {
      await finalize.mutateAsync({
        bookingId: booking.id,
        body: {
          subjective: soap.subjective.trim() || undefined,
          objective: soap.objective.trim() || undefined,
          assessment: soap.assessment.trim() || undefined,
          plan: soap.plan.trim() || undefined,
          prescription: rx
            .filter((r) => r.medication.trim())
            .map((r) => ({
              medication: r.medication.trim(),
              dosage: r.dosage.trim() || undefined,
              instructions: r.instructions.trim() || undefined,
            })),
        },
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? 'Couldn’t finalize these notes. Please try again.'
          : 'Couldn’t reach the server. Please try again.',
      );
      setConfirming(false);
    }
  }

  const submitting = finalize.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consultation notes</DialogTitle>
          <DialogDescription>
            {booking.patientName ?? 'Patient'} ·{' '}
            <span className="tabular">{formatFullDateTime(booking.startsAt, true)}</span>
          </DialogDescription>
        </DialogHeader>

        {booking.concernNote && (
          <div className="rounded-md border border-line bg-bg p-3">
            <p className="text-xs font-medium text-ink-muted">What the patient told you</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{booking.concernNote}</p>
          </div>
        )}

        {SOAP.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={`soap-${field.key}`} className="text-sm font-medium text-ink">
              {field.label}
            </label>
            <textarea
              id={`soap-${field.key}`}
              rows={3}
              maxLength={4000}
              className={TEXTAREA}
              placeholder={field.placeholder}
              value={soap[field.key]}
              onChange={(e) => setSoap((s) => ({ ...s, [field.key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">Prescription</p>
          {rx.map((row) => (
            <div key={row.id} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Medication"
                  maxLength={200}
                  value={row.medication}
                  onChange={(e) => updateRow(row.id, 'medication', e.target.value)}
                />
                <Input
                  placeholder="Dosage"
                  maxLength={200}
                  value={row.dosage}
                  onChange={(e) => updateRow(row.id, 'dosage', e.target.value)}
                />
                <Input
                  placeholder="Instructions"
                  maxLength={500}
                  value={row.instructions}
                  onChange={(e) => updateRow(row.id, 'instructions', e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Remove medication"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-primary-tint hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={addRow}>
            + Add medication
          </Button>
          <p className="text-xs text-ink-muted">Leave empty if no medication is prescribed.</p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-bg p-3">
            <p className="text-sm text-ink">
              Finalise and share with your patient? You won’t be able to edit afterwards.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Not yet
              </Button>
              <Button onClick={handleFinalize} disabled={submitting}>
                {submitting ? 'Finalising…' : 'Finalise'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setConfirming(true)}>Finalise consultation</Button>
            </div>
            <p className="text-right text-xs text-ink-muted">
              Finalising marks the visit complete and shares these notes with your patient.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
