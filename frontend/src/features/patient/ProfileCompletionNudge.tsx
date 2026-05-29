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

  return (
    <div className="mt-6 flex items-start justify-between gap-3 rounded-md border border-primary/20 bg-primary-tint px-4 py-3">
      <div className="text-sm text-ink">
        <p className="font-medium">Complete your profile</p>
        <p className="mt-0.5 text-ink-muted">
          You've filled {filled} of {fields.length} details. Adding the rest helps your
          doctor know who they're seeing before your visit.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link to="/profile">Complete profile</Link>
        </Button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-primary/10 hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
