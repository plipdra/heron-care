import { type ReactNode, useState } from 'react';
import { FileText, LogOut, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { deriveAge, formatDate } from '@/lib/datetime';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import { useAuth } from '@/features/auth/AuthContext';
import { useMyBookings, type PatientBooking } from '@/features/booking/api';
import { displayStatus } from '@/features/booking/status';
import { ConsultationSummaryDialog } from '@/features/booking/ConsultationSummaryDialog';
import { useMyPatientProfile } from './api';

function ViewField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={value ? 'tabular text-sm font-medium text-ink' : 'text-sm text-ink-muted'}>
        {value ?? 'Not provided'}
      </p>
    </div>
  );
}

function CareChips({
  label,
  items,
  empty,
}: {
  label: string;
  items: string[] | null;
  empty: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      {items && items.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="inline-flex items-center rounded-full border border-line bg-primary-tint-sm px-2.5 py-0.5 text-xs font-medium text-ink"
            >
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

// Read-only patient profile — the default /profile surface. Identity + account in
// a left rail; personal details, care, and the patient's own medical records on
// the right. Each section's "Edit" returns to the editor.
export function PatientProfileView({ onEdit }: { onEdit: () => void }) {
  const { user, logout } = useAuth();
  const { data, isPending, isError, error } = useMyPatientProfile();
  const bookings = useMyBookings();
  const [summaryFor, setSummaryFor] = useState<PatientBooking | null>(null);
  const pictureUrl = useAuthedImageUrl(data ? data.profilePictureUrl : null);

  if (isPending) {
    return (
      <main className="container mx-auto flex justify-center px-4 py-20">
        <CrescentSpinner size={64} />
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn't load your profile</h1>
        <p className="mt-2 text-ink-muted">{error?.message}</p>
      </main>
    );
  }

  const records = (bookings.data?.content ?? []).filter(
    (b) => displayStatus(b, Date.now()) === 'completed',
  );
  const dob = data.birthday ? `${formatDate(data.birthday)} · ${deriveAge(data.birthday)}` : null;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,#F0F4FA_0%,#F7F9FC_30%,#FFFFFF_100%)]">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-primary-800">
            Profile &amp; details
          </h1>
          <p className="mt-2 text-ink-muted">Kept private. Helps doctors prepare and reach you.</p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5">
            <Card className="shadow-xs">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar name={data.name ?? 'You'} photoUrl={pictureUrl} size={72} />
                <p className="mt-3 text-lg font-semibold text-ink">{data.name ?? 'Your name'}</p>
                <p className="text-xs text-ink-muted">Patient</p>
                <Button onClick={onEdit} className="mt-4 w-full gap-1.5">
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-xs">
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Account</h2>
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Email
                  </p>
                  <p className="truncate text-sm font-medium text-ink">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <SectionCard title="Personal details">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ViewField label="Full name" value={data.name} />
                <ViewField label="Date of birth" value={dob} />
                <ViewField label="Sex" value={data.sexLabel} />
                <ViewField label="Contact number" value={data.contactNumber} />
                <ViewField label="Weight" value={data.weightKg != null ? `${data.weightKg} kg` : null} />
                <ViewField label="Height" value={data.heightCm != null ? `${data.heightCm} cm` : null} />
              </div>
            </SectionCard>

            <SectionCard title="Care">
              <div className="flex flex-col gap-4">
                <CareChips label="Conditions" items={data.conditions} empty="None recorded." />
                <CareChips label="Allergies" items={data.allergies} empty="No known allergies." />
                <CareChips
                  label="Current medications"
                  items={data.medications}
                  empty="None recorded."
                />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Notes for your doctor
                  </p>
                  <p
                    className={
                      data.notesForDoctor
                        ? 'mt-1 whitespace-pre-wrap text-sm text-ink'
                        : 'mt-1 text-sm text-ink-muted'
                    }
                  >
                    {data.notesForDoctor ?? 'Not provided'}
                  </p>
                </div>
              </div>
            </SectionCard>

            <Card className="shadow-xs">
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Medical records
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Summaries your doctors finalised after each consultation. Yours to keep.
                </p>
                {records.length > 0 ? (
                  <ul className="mt-4 divide-y divide-line">
                    {records.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {r.doctorSpecializationLabel ?? 'Consultation'}
                          </p>
                          <p className="tabular truncate text-xs text-ink-muted">
                            {r.doctorName ?? 'Doctor'} · {formatDate(r.startsAt)}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => setSummaryFor(r)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View summary
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-ink-muted">
                    Your completed consultations and their summaries will appear here.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {summaryFor && (
        <ConsultationSummaryDialog
          bookingId={summaryFor.id}
          heading={`With ${summaryFor.doctorName ?? 'your doctor'}`}
          onClose={() => setSummaryFor(null)}
          documentsBookingId={summaryFor.id}
        />
      )}
    </main>
  );
}
