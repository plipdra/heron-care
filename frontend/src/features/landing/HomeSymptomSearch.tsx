import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Quick-pick chips (same set as the /recommend intake) so the empty box is never
// intimidating — tapping one seeds the field.
const CONCERN_CHIPS = [
  'Headaches',
  'Chest pain',
  'Anxiety or low mood',
  'Skin rash',
  'Joint pain',
  'Stomach issues',
];

// The homepage hero's symptom router — the calm, inline entry to the AI
// recommendation (the product's differentiator, lifted onto the homepage). The
// typed concern is carried into /recommend, which runs it on arrival. A calm
// input by design: soft surface, navy focus ring, no search-engine chrome.
// Guest-accessible; sign-in is asked only later, at the booking tap.
export function HomeSymptomSearch({ align = 'left' }: { align?: 'left' | 'center' }) {
  const navigate = useNavigate();
  const [concern, setConcern] = useState('');
  const centered = align === 'center';

  function addChip(chip: string) {
    setConcern((prev) => {
      if (prev.toLowerCase().includes(chip.toLowerCase())) return prev;
      return prev ? `${prev}, ${chip}` : chip;
    });
  }

  function submit() {
    const trimmed = concern.trim();
    if (trimmed) navigate('/recommend', { state: { concern: trimmed } });
  }

  return (
    <div className={cn('flex w-full max-w-xl flex-col', centered && 'mx-auto items-center text-center')}>
      <textarea
        aria-label="Describe what's going on"
        rows={3}
        maxLength={1000}
        value={concern}
        onChange={(e) => setConcern(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Describe what's going on — e.g. 'chest tightness when I climb stairs'."
        className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink shadow-sm transition placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      />

      <div className={cn('mt-3 flex flex-wrap gap-2', centered && 'justify-center')}>
        {CONCERN_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => addChip(chip)}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-primary hover:text-ink"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className={cn('mt-5 flex flex-wrap items-center gap-x-5 gap-y-3', centered && 'flex-col')}>
        <Button size="lg" onClick={submit} disabled={!concern.trim()}>
          Find the right doctor
        </Button>
        <Link to="/doctors" className="text-sm text-ink-muted transition-colors hover:text-ink">
          Already know who you need? Browse doctors →
        </Link>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Private · we suggest a type of doctor, not a diagnosis · no account needed to start.
      </p>
    </div>
  );
}
