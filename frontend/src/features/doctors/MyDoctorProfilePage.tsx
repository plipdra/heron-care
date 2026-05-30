import { type FormEvent, useEffect, useState } from 'react';
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
  validateHttpUrl,
  validateNumberInRange,
  validateOptionalName,
} from '@/lib/validation';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import { useAuth } from '@/features/auth/AuthContext';
import { MyPatientProfilePage } from '@/features/patient/MyPatientProfilePage';
import { SPECIALIZATIONS } from './specializations';
import { AvailabilityEditor } from './AvailabilityEditor';
import {
  useDeleteMyDoctorPicture,
  useMyDoctorProfile,
  useUpdateMyDoctorProfile,
  useUploadMyDoctorPicture,
} from './api';

type PictureAction =
  | { kind: 'unchanged' }
  | { kind: 'upload'; dataUrl: string }
  | { kind: 'remove' };

// Acts as the role router for /profile. Doctors see the editor below;
// patients see MyPatientProfilePage. Renaming this file to MyProfilePage
// is a planned cleanup — the doctor-only name dates from before patients
// had their own editor surface.
export function MyDoctorProfilePage() {
  const { user } = useAuth();

  if (user?.role === 'PATIENT') {
    return <MyPatientProfilePage />;
  }

  return <DoctorProfileEditor />;
}

function DoctorProfileEditor() {
  const { data, isPending, error, isError } = useMyDoctorProfile();
  const updateMutation = useUpdateMyDoctorProfile();
  const uploadPicture = useUploadMyDoctorPicture();
  const deletePicture = useDeleteMyDoctorPicture();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [defaultMeetingLink, setDefaultMeetingLink] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [pictureAction, setPictureAction] = useState<PictureAction>({ kind: 'unchanged' });
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    bio?: string;
    yearsOfExperience?: string;
    defaultMeetingLink?: string;
  }>({});

  // Cache-bust the picture URL on each profile refetch so a freshly uploaded
  // photo loads instead of the browser's 5-min cached copy.
  const [pictureVersion, setPictureVersion] = useState(0);
  useEffect(() => {
    if (data) {
      setName(data.name ?? '');
      setBio(data.bio ?? '');
      setSpecialization(data.specialization ?? '');
      setDefaultMeetingLink(data.defaultMeetingLink ?? '');
      setYearsOfExperience(
        data.yearsOfExperience !== null && data.yearsOfExperience !== undefined
          ? String(data.yearsOfExperience)
          : '',
      );
      setPictureAction({ kind: 'unchanged' });
      setPictureVersion((v) => v + 1);
    }
  }, [data]);

  // The doctor's own picture URL is the auth-gated route (own bytes, logged-in
  // context), so resolve it through the authed fetch like the patient editor.
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    // Mirror the backend rules PER FIELD so an invalid value is flagged on its
    // own input, not as a vague form-level message; the backend is the gate.
    const next = {
      name: validateOptionalName(name) ?? undefined,
      yearsOfExperience:
        validateNumberInRange(yearsOfExperience, 0, 70, 'Years of experience') ?? undefined,
      defaultMeetingLink: validateHttpUrl(defaultMeetingLink) ?? undefined,
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
      await updateMutation.mutateAsync({
        name: name.trim() || null,
        bio: bio.trim() || null,
        specialization: specialization || null,
        defaultMeetingLink: defaultMeetingLink.trim() || null,
        yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : null,
      });
      setFieldErrors({});
      setFeedback({ kind: 'success', message: 'Your profile is up to date.' });
    } catch (err) {
      // Land the backend's per-field errors on the fields themselves.
      const backend = err instanceof ApiError ? err.problem?.errors : undefined;
      const mapped = {
        name: backend?.name,
        bio: backend?.bio,
        yearsOfExperience: backend?.yearsOfExperience,
        defaultMeetingLink: backend?.defaultMeetingLink,
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

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const saving =
    updateMutation.isPending || uploadPicture.isPending || deletePicture.isPending;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-800">Your profile</h1>
        <p className="mt-2 text-ink-muted">
          How patients see you on Heron. Save changes and they're live.
        </p>
      </header>

      <Card className="mt-8 shadow-sm">
        <CardHeader>
          <CardTitle className="text-primary-800">Public details</CardTitle>
          <CardDescription>Visible to anyone browsing doctors.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <ImageUploadField
              label="Profile photo"
              description="JPEG or PNG, up to 1MB. We resize to a 400px square. Patients see this on your card."
              currentUrl={resolvedPictureUrl}
              pendingDataUrl={pictureAction.kind === 'upload' ? pictureAction.dataUrl : null}
              onChange={(dataUrl) => {
                setPictureAction(
                  dataUrl === null ? { kind: 'remove' } : { kind: 'upload', dataUrl },
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-specialization">Specialisation</Label>
              <select
                id="profile-specialization"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                {SPECIALIZATIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-bio">Bio</Label>
              <textarea
                id="profile-bio"
                rows={4}
                maxLength={2000}
                value={bio}
                aria-invalid={fieldErrors.bio ? true : undefined}
                onChange={(e) => {
                  setBio(e.target.value);
                  clearFieldError('bio');
                }}
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                placeholder="What you specialise in, how patients describe working with you."
              />
              {fieldErrors.bio && (
                <p className="text-sm text-danger">{fieldErrors.bio}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-years">Years of experience</Label>
              <Input
                id="profile-years"
                type="number"
                min={0}
                max={70}
                aria-invalid={fieldErrors.yearsOfExperience ? true : undefined}
                value={yearsOfExperience}
                onChange={(e) => {
                  setYearsOfExperience(e.target.value);
                  clearFieldError('yearsOfExperience');
                }}
              />
              {fieldErrors.yearsOfExperience && (
                <p className="text-sm text-danger">{fieldErrors.yearsOfExperience}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-meeting">Default meeting link</Label>
              <Input
                id="profile-meeting"
                type="url"
                maxLength={500}
                aria-invalid={fieldErrors.defaultMeetingLink ? true : undefined}
                value={defaultMeetingLink}
                onChange={(e) => {
                  setDefaultMeetingLink(e.target.value);
                  clearFieldError('defaultMeetingLink');
                }}
                placeholder="https://meet.google.com/your-room"
              />
              {fieldErrors.defaultMeetingLink && (
                <p className="text-sm text-danger">{fieldErrors.defaultMeetingLink}</p>
              )}
              <p className="text-xs text-ink-muted">
                Patients see this link when they join your consultation. Use a
                Google Meet, Zoom, or Teams link you control.
              </p>
            </div>

            {/* Read-only credentials — captured at registration, printed on the
                clinical documents. Editing licenses is Future Work. */}
            <div className="rounded-md border border-line bg-surface-raised px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                License — shown on your documents
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                <span className="tabular text-ink">
                  <span className="text-ink-muted">PRC No. </span>
                  {data.prcLicenseNo ?? '—'}
                </span>
                <span className="tabular text-ink">
                  <span className="text-ink-muted">PTR No. </span>
                  {data.ptrNo ?? '—'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                Printed on your prescriptions and visit summaries.
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

      <AvailabilityEditor availability={data.availability} />
    </main>
  );
}
