import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The homepage hero's symptom router — a single, calm search bar that carries the
// typed concern into /recommend (which runs it on arrival). The full 2-step intake
// lives on /recommend; here the bar just says "this is where you begin".
// Guest-accessible; sign-in is asked only later, at the booking tap.
export function HomeSymptomSearch({ align = 'left' }: { align?: 'left' | 'center' }) {
  const navigate = useNavigate();
  const [concern, setConcern] = useState('');
  const [concernError, setConcernError] = useState<string | null>(null);
  const centered = align === 'center';

  function submit() {
    const trimmed = concern.trim();
    if (trimmed.replace(/\s/g, '').length < 10) {
      setConcernError(
        "Tell us a little more about what's going on — even a sentence helps us match the right specialist.",
      );
      return;
    }
    setConcernError(null);
    navigate('/recommend', { state: { concern: trimmed } });
  }

  return (
    <div className={cn('flex w-full max-w-2xl flex-col', centered && 'mx-auto items-center text-center')}>
      <div className="flex w-full items-center gap-2 rounded-xl border border-ai-glow bg-surface p-1.5 shadow-md transition focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint">
        <Search aria-hidden="true" className="ml-2.5 h-5 w-5 shrink-0 text-ink-muted" />
        <input
          aria-label="Describe what's going on"
          value={concern}
          maxLength={1000}
          onChange={(e) => {
            setConcern(e.target.value);
            if (concernError) setConcernError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          aria-invalid={concernError ? true : undefined}
          aria-describedby={concernError ? 'home-concern-error' : undefined}
          placeholder="e.g. 'chest tightness when I climb stairs'"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-ink-muted"
        />
        <Button size="lg" onClick={submit} disabled={!concern.trim()} className="shrink-0 gap-1.5">
          Find a doctor
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {concernError && (
        <p id="home-concern-error" className="mt-2 text-sm text-danger">
          {concernError}
        </p>
      )}

      <div className={cn('mt-3', centered && 'text-center')}>
        <Link to="/doctors" className="text-sm text-ink-muted transition-colors hover:text-ink">
          Know who you need?{' '}
          <span className="font-medium text-primary hover:underline">Browse all doctors →</span>
        </Link>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Private · we suggest a type of doctor, not a diagnosis · no account needed to start.
      </p>
    </div>
  );
}
