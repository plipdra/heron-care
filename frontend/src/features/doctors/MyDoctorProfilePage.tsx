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
import { ApiError } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { MyPatientProfilePage } from '@/features/patient/MyPatientProfilePage';
import { SPECIALIZATIONS } from './specializations';
import { useMyDoctorProfile, useUpdateMyDoctorProfile } from './api';

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

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [defaultMeetingLink, setDefaultMeetingLink] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);

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
    }
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await updateMutation.mutateAsync({
        name: name || undefined,
        bio: bio || undefined,
        specialization: specialization || undefined,
        defaultMeetingLink: defaultMeetingLink || undefined,
        yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : undefined,
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

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-2 text-ink-muted">
          How patients see you on Heron. Save changes and they're live.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Public details</CardTitle>
          <CardDescription>Visible to anyone browsing doctors.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
                onChange={(e) => setBio(e.target.value)}
                className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                placeholder="What you specialise in, how patients describe working with you."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-years">Years of experience</Label>
              <Input
                id="profile-years"
                type="number"
                min={0}
                max={70}
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-meeting">Default meeting link</Label>
              <Input
                id="profile-meeting"
                type="url"
                maxLength={500}
                value={defaultMeetingLink}
                onChange={(e) => setDefaultMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/your-room"
              />
              <p className="text-xs text-ink-muted">
                Patients see this link when they join your consultation. Use a
                Google Meet, Zoom, or Teams link you control.
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

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
