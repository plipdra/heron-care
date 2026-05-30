import { type ReactNode } from 'react';
import { LogOut, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shared/Avatar';
import { CrescentSpinner } from '@/components/shared/CrescentSpinner';
import { formatDate } from '@/lib/datetime';
import { useAuthedImageUrl } from '@/lib/useAuthedImageUrl';
import { useAuth } from '@/features/auth/AuthContext';
import { DoctorCard } from './DoctorCard';
import { useMyDoctorProfile, type Availability } from './api';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

// "09:00:00" / "09:00" → "9:00 AM".
function to12h(t: string): string {
  const [hStr, m] = t.split(':');
  const h = Number(hStr);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

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

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function HoursRow({ day, av }: { day: string; av: Availability | null }) {
  const entry = av?.weeklySchedule?.find((e) => e.dayOfWeek === day);
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="text-sm font-medium text-ink">{DAY_LABEL[day]}</span>
      {entry ? (
        <span className="tabular text-sm text-ink">
          {to12h(entry.startTime)} – {to12h(entry.endTime)}
        </span>
      ) : (
        <span className="text-sm text-ink-muted">Not seeing patients</span>
      )}
    </div>
  );
}

// Read-only doctor profile — the default /profile surface for doctors. Practice
// details, consultation hours, time off, a public-card preview, and account.
export function DoctorProfileView({ onEdit }: { onEdit: () => void }) {
  const { user, logout } = useAuth();
  const { data, isPending, isError, error } = useMyDoctorProfile();
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

  const blocked = data.availability?.blockedRanges ?? [];

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,#F0F4FA_0%,#F7F9FC_30%,#FFFFFF_100%)]">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-primary-800">Your profile</h1>
          <p className="mt-2 text-ink-muted">
            Your practice details, what patients see, and your account.
          </p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5">
            <Card className="shadow-xs">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar name={data.name} photoUrl={pictureUrl} size={72} />
                <p className="mt-3 text-lg font-semibold text-ink">{data.name}</p>
                <p className="text-xs text-ink-muted">
                  {data.specializationLabel ?? 'Clinician'}
                  {data.yearsOfExperience != null ? ` · ${data.yearsOfExperience} years` : ''}
                </p>
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

            {/* How patients see you. */}
            <Card className="shadow-xs">
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Public preview
                </h2>
                <p className="mt-1 text-xs text-ink-muted">What patients see in search.</p>
                <div className="mt-4">
                  <DoctorCard doctor={data} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <SectionCard title="Practice details" onEdit={onEdit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ViewField label="Specialisation" value={data.specializationLabel} />
                <ViewField
                  label="Years of experience"
                  value={data.yearsOfExperience != null ? `${data.yearsOfExperience} years` : null}
                />
                <ViewField label="Default meeting link" value={data.defaultMeetingLink} />
                <ViewField label="Typical visit" value="~30 minutes" />
                <ViewField label="PRC No." value={data.prcLicenseNo} />
                <ViewField label="PTR No." value={data.ptrNo} />
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Bio</p>
                <p className={data.bio ? 'mt-1 text-sm leading-relaxed text-ink' : 'mt-1 text-sm text-ink-muted'}>
                  {data.bio ?? 'Not provided'}
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Consultation hours" onEdit={onEdit}>
              <div>
                {DAY_ORDER.map((d) => (
                  <HoursRow key={d} day={d} av={data.availability} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Time off" onEdit={onEdit}>
              {blocked.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {blocked.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-line bg-surface-raised px-3 py-2"
                    >
                      <span className="tabular text-sm text-ink">
                        {formatDate(b.startsAt)} – {formatDate(b.endsAt)}
                      </span>
                      {b.reason && <span className="text-xs text-ink-muted">{b.reason}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No time off scheduled.</p>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}
