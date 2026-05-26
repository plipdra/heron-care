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
  useDeleteProfilePicture,
  useMyPatientProfile,
  useUpdateMyPatientProfile,
  useUploadProfilePicture,
} from './api';

type PictureAction =
  | { kind: 'unchanged' }
  | { kind: 'upload'; dataUrl: string }
  | { kind: 'remove' };

const TRACKED_FIELDS = [
  'name',
  'birthday',
  'weightKg',
  'heightCm',
  'contactNumber',
  'medicalHistory',
  'profilePicture',
] as const;

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
    const filled = [
      data.name,
      data.birthday,
      data.weightKg,
      data.heightCm,
      data.contactNumber,
      data.medicalHistory,
    ].filter((v) => v !== null && v !== '').length;
    return { filled, total: TRACKED_FIELDS.length - 1 };
  }, [data]);

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={32} />
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

  const currentPictureUrl =
    pictureAction.kind === 'remove'
      ? null
      : `${data.profilePictureUrl}?v=${pictureVersion}`;
  const pendingPicture =
    pictureAction.kind === 'upload' ? pictureAction.dataUrl : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      if (pictureAction.kind === 'upload') {
        await uploadPicture.mutateAsync(pictureAction.dataUrl);
      } else if (pictureAction.kind === 'remove') {
        await deletePicture.mutateAsync();
      }
      await updateProfile.mutateAsync({
        name: name || undefined,
        birthday: birthday || undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        contactNumber: contactNumber || undefined,
        medicalHistory: medicalHistory || undefined,
      });
      setFeedback({ kind: 'success', message: 'Your profile is up to date.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError
            ? err.problem?.detail ?? err.message
            : 'Could not save changes.',
      });
    }
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
              currentUrl={currentPictureUrl}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-birthday">Birthday</Label>
                <Input
                  id="profile-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-weight">Weight (kg)</Label>
                <Input
                  id="profile-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1000"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-height">Height (cm)</Label>
                <Input
                  id="profile-height"
                  type="number"
                  step="1"
                  min="10"
                  max="300"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-contact">Contact number</Label>
              <Input
                id="profile-contact"
                type="tel"
                maxLength={30}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+63 917 555 1234"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-history">Basic medical history</Label>
              <textarea
                id="profile-history"
                rows={5}
                maxLength={5000}
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                placeholder="Conditions, allergies, medications, prior surgeries — anything your doctor should know."
              />
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
