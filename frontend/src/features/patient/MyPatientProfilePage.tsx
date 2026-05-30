import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { ImageUploadField } from '@/components/shared/ImageUploadField';
import { ApiError } from '@/lib/api';
import {
  validateBirthday,
  validateNumberInRange,
  validateOptionalName,
  validatePhone,
} from '@/lib/validation';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import { PatientProfileView } from './PatientProfileView';
import {
  SEX_OPTIONS,
  type Sex,
  useDeleteProfilePicture,
  useMyPatientProfile,
  useUpdateMyPatientProfile,
  useUploadProfilePicture,
} from './api';

// /profile defaults to a calm read-only VIEW; "Edit profile" swaps in the editor,
// and saving (or Cancel) returns here. Mirrors the design's view-first profile.
export function MyPatientProfilePage() {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  return mode === 'edit' ? (
    <PatientProfileEditor onDone={() => setMode('view')} />
  ) : (
    <PatientProfileView onEdit={() => setMode('edit')} />
  );
}

type PictureAction =
  | { kind: 'unchanged' }
  | { kind: 'upload'; dataUrl: string }
  | { kind: 'remove' };

const MAX_ENTRY = 200;

// A small chip-based list editor for the care fields (conditions, allergies,
// medications). Enter or comma commits an entry; entries render as removable
// chips. Tags hold health data, so the chip text is ink (never decoratively
// coloured) over a barely-there blue tint — per the brand's health-data rule.
function TagInput({
  id,
  label,
  hint,
  placeholder,
  tags,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  tags: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v || v.length > MAX_ENTRY || tags.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...tags, v]);
    setDraft('');
  }

  function removeAt(i: number) {
    onChange(tags.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      removeAt(tags.length - 1);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-2 shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
        {tags.map((t, i) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-primary-tint-sm px-2.5 py-1 text-xs font-medium text-ink"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => removeAt(i)}
              disabled={disabled}
              className="rounded-full text-ink-muted transition-colors hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={tags.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          maxLength={MAX_ENTRY}
          className="min-w-[10ch] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
      <p className="text-xs text-ink-muted">Press Enter or comma to add. {hint}</p>
    </div>
  );
}

function PatientProfileEditor({ onDone }: { onDone: () => void }) {
  const { data, isPending, isError, error } = useMyPatientProfile();
  const updateProfile = useUpdateMyPatientProfile();
  const uploadPicture = useUploadProfilePicture();
  const deletePicture = useDeleteProfilePicture();

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [notesForDoctor, setNotesForDoctor] = useState('');
  const [pictureAction, setPictureAction] = useState<PictureAction>({ kind: 'unchanged' });
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    birthday?: string;
    weightKg?: string;
    heightCm?: string;
    contactNumber?: string;
    notesForDoctor?: string;
  }>({});

  // Cache-bust the picture URL on each profile refetch so a freshly uploaded
  // picture loads instead of the browser's 5-min cached copy.
  const [pictureVersion, setPictureVersion] = useState(0);
  useEffect(() => {
    if (data) {
      setName(data.name ?? '');
      setBirthday(data.birthday ?? '');
      setSex(data.sex ?? '');
      setWeightKg(data.weightKg !== null ? String(data.weightKg) : '');
      setHeightCm(data.heightCm !== null ? String(data.heightCm) : '');
      setContactNumber(data.contactNumber ?? '');
      setConditions(data.conditions ?? []);
      setAllergies(data.allergies ?? []);
      setMedications(data.medications ?? []);
      setNotesForDoctor(data.notesForDoctor ?? '');
      setPictureAction({ kind: 'unchanged' });
      setPictureVersion((v) => v + 1);
    }
  }, [data]);

  const completeness = useMemo(() => {
    if (!data) return null;
    // Count exactly the demographic essentials we evaluate, divided by that same
    // count — so the ratio can never claim "complete" while fields are blank. The
    // care lists stay optional (an empty allergy list is a valid "none").
    const fields = [
      data.name,
      data.birthday,
      data.sex,
      data.weightKg,
      data.heightCm,
      data.contactNumber,
    ];
    const filled = fields.filter(
      (v) => v !== null && v !== undefined && v !== '',
    ).length;
    return { filled, total: fields.length };
  }, [data]);

  // The picture endpoint is auth-gated, so fetch the bytes with our token and
  // render an object URL; null (no picture / removed) falls back to "Upload".
  // ?v bumps on every refetch so a freshly saved picture isn't the cached one.
  const pictureServerUrl =
    data && pictureAction.kind !== 'remove'
      ? `${data.profilePictureUrl}?v=${pictureVersion}`
      : null;
  const resolvedPictureUrl = useAuthedImageUrl(pictureServerUrl);

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={64} />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn't load your profile
        </h1>
        <p className="mt-2 text-ink-muted">{error?.message}</p>
      </main>
    );
  }

  const pendingPicture =
    pictureAction.kind === 'upload' ? pictureAction.dataUrl : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    // Mirror the backend rules PER FIELD for instant, located feedback — so an
    // invalid value is flagged on its own input, never a vague form-level message.
    const next = {
      name: validateOptionalName(name) ?? undefined,
      birthday: validateBirthday(birthday) ?? undefined,
      weightKg: validateNumberInRange(weightKg, 0.1, 1000, 'Weight') ?? undefined,
      heightCm: validateNumberInRange(heightCm, 10, 300, 'Height') ?? undefined,
      contactNumber: validatePhone(contactNumber) ?? undefined,
    };
    setFieldErrors(next);
    if (Object.values(next).some(Boolean)) {
      setFeedback({ kind: 'error', message: 'Please fix the highlighted fields.' });
      return;
    }
    try {
      if (pictureAction.kind === 'upload') {
        await uploadPicture.mutateAsync(pictureAction.dataUrl);
      } else if (pictureAction.kind === 'remove') {
        await deletePicture.mutateAsync();
      }
      // Full replace: send every field (null/empty when cleared) so emptying a
      // field actually clears it server-side, instead of being dropped and reverting.
      await updateProfile.mutateAsync({
        name: name.trim() || null,
        birthday: birthday || null,
        sex: sex || null,
        weightKg: weightKg ? Number(weightKg) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        contactNumber: contactNumber.trim() || null,
        conditions,
        allergies,
        medications,
        notesForDoctor: notesForDoctor.trim() || null,
      });
      setFieldErrors({});
      onDone(); // return to the read-only view, which shows the saved data
    } catch (err) {
      // Place the backend's per-field errors on the fields themselves, so the
      // patient never has to guess which input the server rejected (e.g. a phone
      // number that passed the light client check but failed libphonenumber).
      const backend = err instanceof ApiError ? err.problem?.errors : undefined;
      const mapped = {
        name: backend?.name,
        birthday: backend?.birthday,
        weightKg: backend?.weightKg,
        heightCm: backend?.heightCm,
        contactNumber: backend?.contactNumber,
        notesForDoctor: backend?.notesForDoctor,
      };
      // List-element errors arrive on paths like "conditions[0].<list element>";
      // surface those at form level since they can't attach to a single input.
      const listError = backend
        ? Object.keys(backend).find((k) =>
            /^(conditions|allergies|medications)/.test(k),
          )
        : undefined;
      if (Object.values(mapped).some(Boolean) || listError) {
        setFieldErrors(mapped);
        setFeedback({
          kind: 'error',
          message: listError
            ? backend![listError]
            : 'Please fix the highlighted fields.',
        });
      } else {
        setFeedback({
          kind: 'error',
          message:
            err instanceof ApiError
              ? err.problem?.detail ?? err.message
              : 'Could not save changes.',
        });
      }
    }
  }

  // Clear a field's error as soon as the patient edits it.
  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const saving =
    updateProfile.isPending || uploadPicture.isPending || deletePicture.isPending;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary-800">Edit profile</h1>
          <p className="mt-2 text-ink-muted">
            What your doctor sees when you book a consultation.
          </p>
        </div>
        {completeness && (
          <span
            title="Counts the six personal details below. The care lists are optional and not counted."
            className="rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary tabular"
          >
            {completeness.filled} of {completeness.total} personal details
          </span>
        )}
      </header>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            All fields are optional. Fill what you're comfortable sharing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <ImageUploadField
              label="Profile picture"
              description="JPEG or PNG, up to 1MB. We resize to a 400px square."
              currentUrl={resolvedPictureUrl}
              pendingDataUrl={pendingPicture}
              onChange={(dataUrl) => {
                setPictureAction(
                  dataUrl === null
                    ? { kind: 'remove' }
                    : { kind: 'upload', dataUrl },
                );
              }}
              disabled={saving}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                maxLength={200}
                aria-invalid={fieldErrors.name ? true : undefined}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
              />
              {fieldErrors.name && (
                <p className="text-sm text-danger">{fieldErrors.name}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-birthday">Birthday</Label>
                <Input
                  id="profile-birthday"
                  type="date"
                  aria-invalid={fieldErrors.birthday ? true : undefined}
                  value={birthday}
                  onChange={(e) => {
                    setBirthday(e.target.value);
                    clearFieldError('birthday');
                  }}
                />
                {fieldErrors.birthday && (
                  <p className="text-sm text-danger">{fieldErrors.birthday}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-sex">Sex</Label>
                <select
                  id="profile-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex | '')}
                  className="flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <option value="">Prefer not to say</option>
                  {SEX_OPTIONS.filter((o) => o.value !== 'UNSPECIFIED').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-weight">Weight (kg)</Label>
                <Input
                  id="profile-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1000"
                  aria-invalid={fieldErrors.weightKg ? true : undefined}
                  value={weightKg}
                  onChange={(e) => {
                    setWeightKg(e.target.value);
                    clearFieldError('weightKg');
                  }}
                />
                {fieldErrors.weightKg && (
                  <p className="text-sm text-danger">{fieldErrors.weightKg}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-height">Height (cm)</Label>
                <Input
                  id="profile-height"
                  type="number"
                  step="1"
                  min="10"
                  max="300"
                  aria-invalid={fieldErrors.heightCm ? true : undefined}
                  value={heightCm}
                  onChange={(e) => {
                    setHeightCm(e.target.value);
                    clearFieldError('heightCm');
                  }}
                />
                {fieldErrors.heightCm && (
                  <p className="text-sm text-danger">{fieldErrors.heightCm}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-contact">Contact number</Label>
              <Input
                id="profile-contact"
                type="tel"
                maxLength={30}
                aria-invalid={fieldErrors.contactNumber ? true : undefined}
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  clearFieldError('contactNumber');
                }}
                placeholder="+63 917 555 1234"
              />
              {fieldErrors.contactNumber && (
                <p className="text-sm text-danger">{fieldErrors.contactNumber}</p>
              )}
            </div>

            <div className="border-t border-line pt-5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">Care profile</h2>
                <span className="rounded-full border border-line bg-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Optional
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                What your doctor should know before the visit — all optional, and not part of the
                count above. Leave a list empty if there's nothing to add.
              </p>
            </div>
            <TagInput
              id="profile-conditions"
              label="Conditions"
              hint="e.g. Hypertension, Mild asthma"
              placeholder="Add a condition…"
              tags={conditions}
              onChange={setConditions}
              disabled={saving}
            />
            <TagInput
              id="profile-allergies"
              label="Allergies"
              hint="e.g. Penicillin, Peanuts"
              placeholder="Add an allergy…"
              tags={allergies}
              onChange={setAllergies}
              disabled={saving}
            />
            <TagInput
              id="profile-medications"
              label="Current medications"
              hint="e.g. Losartan 50mg daily"
              placeholder="Add a medication…"
              tags={medications}
              onChange={setMedications}
              disabled={saving}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-notes">Notes for your doctor</Label>
              <textarea
                id="profile-notes"
                rows={4}
                maxLength={2000}
                value={notesForDoctor}
                aria-invalid={fieldErrors.notesForDoctor ? true : undefined}
                onChange={(e) => {
                  setNotesForDoctor(e.target.value);
                  clearFieldError('notesForDoctor');
                }}
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-xs placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                placeholder="Anything else your doctor should know — family history, lifestyle, prior surgeries."
              />
              {fieldErrors.notesForDoctor && (
                <p className="text-sm text-danger">{fieldErrors.notesForDoctor}</p>
              )}
              <p className="text-xs text-ink-muted">
                Shared with the doctors you book with. Up to 2,000 characters.
              </p>
            </div>

            {feedback && (
              <p
                className={`text-sm ${
                  feedback.kind === 'success' ? 'text-success' : 'text-danger'
                }`}
              >
                {feedback.message}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
