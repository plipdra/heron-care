import { type FormEvent, useEffect, useMemo, useState } from 'react';
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
import {
  useDeleteProfilePicture,
  useMyPatientProfile,
  useUpdateMyPatientProfile,
  useUploadProfilePicture,
} from './api';

type PictureAction =
  | { kind: 'unchanged' }
  | { kind: 'upload'; dataUrl: string }
  | { kind: 'remove' };

export function MyPatientProfilePage() {
  const { data, isPending, isError, error } = useMyPatientProfile();
  const updateProfile = useUpdateMyPatientProfile();
  const uploadPicture = useUploadProfilePicture();
  const deletePicture = useDeleteProfilePicture();

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
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
    medicalHistory?: string;
  }>({});

  // Cache-bust the picture URL on each profile refetch so a freshly uploaded
  // picture loads instead of the browser's 5-min cached copy.
  const [pictureVersion, setPictureVersion] = useState(0);
  useEffect(() => {
    if (data) {
      setName(data.name ?? '');
      setBirthday(data.birthday ?? '');
      setWeightKg(data.weightKg !== null ? String(data.weightKg) : '');
      setHeightCm(data.heightCm !== null ? String(data.heightCm) : '');
      setContactNumber(data.contactNumber ?? '');
      setMedicalHistory(data.medicalHistory ?? '');
      setPictureAction({ kind: 'unchanged' });
      setPictureVersion((v) => v + 1);
    }
  }, [data]);

  const completeness = useMemo(() => {
    if (!data) return null;
    // Count exactly the fields we evaluate, and divide by that same count — so the
    // ratio can never claim "complete" while fields are blank.
    const fields = [
      data.name,
      data.birthday,
      data.weightKg,
      data.heightCm,
      data.contactNumber,
      data.medicalHistory,
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
      // Full replace: send every field (null when cleared) so emptying a field
      // actually clears it server-side, instead of being dropped and reverting.
      await updateProfile.mutateAsync({
        name: name.trim() || null,
        birthday: birthday || null,
        weightKg: weightKg ? Number(weightKg) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        contactNumber: contactNumber.trim() || null,
        medicalHistory: medicalHistory.trim() || null,
      });
      setFieldErrors({});
      setFeedback({ kind: 'success', message: 'Your profile is up to date.' });
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
        medicalHistory: backend?.medicalHistory,
      };
      if (Object.values(mapped).some(Boolean)) {
        setFieldErrors(mapped);
        setFeedback({ kind: 'error', message: 'Please fix the highlighted fields.' });
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
          <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
          <p className="mt-2 text-ink-muted">
            What your doctor sees when you book a consultation.
          </p>
        </div>
        {completeness && (
          <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary tabular">
            {completeness.filled} of {completeness.total} fields filled
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-history">Basic medical history</Label>
              <textarea
                id="profile-history"
                rows={5}
                maxLength={5000}
                value={medicalHistory}
                aria-invalid={fieldErrors.medicalHistory ? true : undefined}
                onChange={(e) => {
                  setMedicalHistory(e.target.value);
                  clearFieldError('medicalHistory');
                }}
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                placeholder="Conditions, allergies, medications, prior surgeries — anything your doctor should know."
              />
              {fieldErrors.medicalHistory && (
                <p className="text-sm text-danger">{fieldErrors.medicalHistory}</p>
              )}
              <p className="text-xs text-ink-muted">
                Shared with the doctors you book with. Up to 5,000 characters.
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

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
