import { useEffect, useRef, useState } from 'react';
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
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { ApiError } from '@/lib/api';
import { deriveAge, formatDate, formatFullDateTime } from '@/lib/datetime';
import {
  useConsultationNotes,
  usePatientContext,
  useSaveConsultationNotes,
  type DoctorBooking,
} from './api';

const TEXTAREA =
  'flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

type RxRow = { id: number; medication: string; dosage: string; instructions: string };

const SOAP: { key: 'subjective' | 'objective' | 'assessment' | 'plan'; label: string; placeholder: string }[] = [
  { key: 'subjective', label: 'Subjective', placeholder: 'What the patient reports — symptoms, history, in their words.' },
  { key: 'objective', label: 'Objective', placeholder: 'What you observed — findings, vitals, examination.' },
  { key: 'assessment', label: 'Assessment', placeholder: 'Your clinical impression or diagnosis.' },
  { key: 'plan', label: 'Plan', placeholder: 'Next steps — treatment, follow-up, referrals.' },
];

// Section label for a patient-context block in the left pane.
const NP_LBL = 'text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-muted';
const NP_BLOCK = 'border-t border-line pt-3.5';

// A labelled patient-context value in the left pane.
function CtxField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">{label}</p>
      <p className={value ? 'tabular text-sm text-ink' : 'text-sm text-ink-muted'}>
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

// One care list (conditions / allergies / medications). Entries are health data:
// conditions and medications carry a calm navy tint, allergies a warning tint so
// they catch the eye while writing — the one place warm colour earns its keep. A
// null or empty list shows the calm empty line, so a blank section still reads.
function CareList({
  label,
  items,
  empty,
  tone = 'care',
}: {
  label: string;
  items: string[] | null;
  empty: string;
  tone?: 'care' | 'allergy';
}) {
  return (
    <div className={NP_BLOCK}>
      <p className={`${NP_LBL} mb-1.5`}>{label}</p>
      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className={
                tone === 'allergy'
                  ? 'inline-flex items-center rounded-full border border-[rgba(199,125,82,0.22)] bg-[rgba(199,125,82,0.07)] px-2.5 py-0.5 text-[11.5px] font-semibold text-warning'
                  : 'inline-flex items-center rounded-full border border-primary-tint-md bg-primary-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-primary-800'
              }
            >
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

// Doctor's write surface, side-by-side: the patient's context to read from on the
// left, the SOAP + prescription form on the right. "Save draft" keeps editing
// privately; "Finalise consultation" is the deliberate, confirmed action that
// locks the record, completes the visit, and shares it with the patient.
export function WriteConsultationNotesDialog({
  booking,
  onClose,
}: {
  booking: DoctorBooking;
  onClose: () => void;
}) {
  const save = useSaveConsultationNotes();
  const { data: context, isPending: contextPending } = usePatientContext(booking.id, true);
  // Only fetch an existing draft when the list told us there is one.
  const { data: draft } = useConsultationNotes(booking.id, booking.hasDraft);

  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [rx, setRx] = useState<RxRow[]>([{ id: 1, medication: '', dosage: '', instructions: '' }]);
  const [nextId, setNextId] = useState(2);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [action, setAction] = useState<'idle' | 'draft' | 'finalise'>('idle');

  // Pre-fill from the saved draft, once.
  const filled = useRef(false);
  useEffect(() => {
    if (!draft || filled.current) return;
    filled.current = true;
    setSoap({
      subjective: draft.subjective ?? '',
      objective: draft.objective ?? '',
      assessment: draft.assessment ?? '',
      plan: draft.plan ?? '',
    });
    if (draft.prescription.length > 0) {
      setRx(draft.prescription.map((p, i) => ({
        id: i + 1,
        medication: p.medication,
        dosage: p.dosage ?? '',
        instructions: p.instructions ?? '',
      })));
      setNextId(draft.prescription.length + 1);
    }
  }, [draft]);

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

  async function submit(finalise: boolean) {
    setError(null);
    setSavedNote(null);
    setAction(finalise ? 'finalise' : 'draft');
    try {
      await save.mutateAsync({
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
          finalise,
        },
      });
      if (finalise) {
        onClose();
      } else {
        setSavedNote('Draft saved. Only you can see it until you finalise.');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem?.detail ?? 'Couldn’t save these notes — your draft is still here.'
          : 'Couldn’t reach the server. Check your connection and try again.',
      );
      setConfirming(false);
    } finally {
      setAction('idle');
    }
  }

  const submitting = save.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consultation notes</DialogTitle>
          <DialogDescription>
            {booking.patientName ?? 'Patient'} ·{' '}
            <span className="tabular">{formatFullDateTime(booking.startsAt, true)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
          {/* Left: patient context to read while writing — a calm surface-raised
              band, kept in view alongside the form. */}
          <aside className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-[15px] font-bold text-primary">
                {(booking.patientName ?? 'P')
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold tracking-[-0.01em] text-ink">
                  {booking.patientName ?? 'Patient'}
                </p>
                {context && (
                  <p className="text-[12.5px] font-medium text-ink-muted">
                    {[
                      context.birthday ? `${deriveAge(context.birthday)}` : null,
                      context.sexLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Details on file'}
                  </p>
                )}
              </div>
            </div>

            <div className={NP_BLOCK}>
              <p className={`${NP_LBL} mb-1`}>Reason for visit</p>
              <p className="text-[13px] leading-relaxed text-ink">
                {booking.concernNote ?? <span className="text-ink-muted">No note added.</span>}
              </p>
            </div>

            {contextPending && (
              <div className="flex justify-center py-4">
                <CrescentSpinner size={28} />
              </div>
            )}

            {context && (
              <>
                <CareList
                  label="Conditions"
                  items={context.conditions}
                  empty="No conditions shared."
                />
                <CareList
                  label="Allergies"
                  items={context.allergies}
                  empty="No known allergies shared."
                  tone="allergy"
                />
                <CareList
                  label="Current medications"
                  items={context.medications}
                  empty="No current medications shared."
                />
                {context.notesForDoctor && (
                  <div className={NP_BLOCK}>
                    <p className={`${NP_LBL} mb-1`}>Notes for you</p>
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink">
                      {context.notesForDoctor}
                    </p>
                  </div>
                )}
                <div className={NP_BLOCK}>
                  <p className={`${NP_LBL} mb-1`}>Vitals (patient-reported)</p>
                  <p className="tabular text-[13px] text-ink">
                    {context.weightKg != null && context.heightCm != null
                      ? `BMI ${(context.weightKg / (context.heightCm / 100) ** 2).toFixed(1)} · ${context.weightKg} kg · ${context.heightCm} cm`
                      : context.weightKg != null
                        ? `${context.weightKg} kg`
                        : context.heightCm != null
                          ? `${context.heightCm} cm`
                          : 'Not provided · no in-person exam over video'}
                  </p>
                </div>
                <div className={`${NP_BLOCK} grid grid-cols-2 gap-3`}>
                  <CtxField label="Born" value={context.birthday ? formatDate(context.birthday) : null} />
                  <CtxField label="Contact" value={context.contactNumber} />
                </div>
              </>
            )}
          </aside>

          {/* Right: the note form. */}
          <div className="flex flex-col gap-4">
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
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {savedNote && <p className="text-sm text-success">{savedNote}</p>}

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-bg p-3">
            <p className="text-sm text-ink">
              Finalise and share with your patient? You won’t be able to edit afterwards.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>
                Not yet
              </Button>
              <Button onClick={() => submit(true)} disabled={submitting}>
                {action === 'finalise' ? 'Finalising…' : 'Finalise'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => submit(false)} disabled={submitting}>
                {action === 'draft' ? 'Saving…' : 'Save draft'}
              </Button>
              <Button onClick={() => setConfirming(true)} disabled={submitting}>
                Finalise consultation
              </Button>
            </div>
            <p className="text-right text-xs text-ink-muted">
              A draft stays private. Finalising completes the visit and shares these notes with
              your patient.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
