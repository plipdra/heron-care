import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyPatientProfile } from './api';

const DISMISS_KEY = 'heron:profile-nudge-dismissed';

// A soft, dismissible prompt — booking is never blocked. When the patient's
// profile is incomplete, this gently encourages finishing it so the doctor has
// useful context before the consult. Dismissal sticks for the session.
export function ProfileCompletionNudge() {
  const { data } = useMyPatientProfile();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  if (!data || dismissed) return null;

  // The demographic essentials that help a doctor place the patient. The care
  // lists (conditions/allergies/medications) and notes stay optional — an empty
  // allergy list is a valid "none", so nagging on it would never clear.
  const fields = [
    data.name,
    data.birthday,
    data.sex,
    data.weightKg,
    data.heightCm,
    data.contactNumber,
  ];
  const filled = fields.filter((v) => v !== null && v !== undefined && v !== '').length;
  if (filled >= fields.length) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  const pct = Math.round((filled / fields.length) * 100);

  return (
    <div className="relative mt-6 overflow-hidden rounded-lg border border-ai-glow bg-[linear-gradient(180deg,#EEF3FB_0%,#F4F7FB_60%,#FFFFFF_100%)] px-5 py-4 shadow-sm animate-banner-in">
      {/* Crescent corner accent — the banner's quiet brand mark. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 opacity-[0.08]"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-primary-800">Complete your profile</p>
          <p className="mt-0.5 text-ink-muted">
            You've filled {filled} of {fields.length} details. Adding the rest helps your
            doctor know who they're seeing before your visit.
          </p>
          {/* Progress — calm, primary fill, never an alarm. */}
          <div className="mt-3 flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-tint-md">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular text-xs font-medium text-ink-muted">{pct}%</span>
          </div>
          <Button asChild size="sm" className="mt-3 shadow-xs">
            <Link to="/profile">Complete profile</Link>
          </Button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="relative shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-primary/10 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
