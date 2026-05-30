import { cn } from '@/lib/utils';

type SpinnerProps = {
  className?: string;
  size?: number;
  // 'white' uses the white crescent for dark surfaces (e.g. the AI loading header).
  variant?: 'blue' | 'white';
  // Adds the gentle ai-pulse "breath" on top of the rotation — used to give the
  // AI loading moment extra presence (BRAND.md §7, design handoff §2).
  pulse?: boolean;
};

// Brand-pattern loader — rotating crescent. Slower-than-default 1.6s rotation
// because the brand voice is calm (BRAND.md §8 — stillness beats motion).
export function CrescentSpinner({ className, size = 48, variant = 'blue', pulse = false }: SpinnerProps) {
  const img = (
    <img
      src={variant === 'white' ? '/brand/crescent-white.svg' : '/brand/crescent-blue.svg'}
      alt=""
      role="status"
      aria-label="Loading"
      width={size}
      height={size}
      className={cn(
        'animate-spin',
        // The AI loading moment (pulse) rotates at the calmer 2.4s per source;
        // the plain spinner stays at 1.6s.
        pulse ? '[animation-duration:2.4s]' : '[animation-duration:1.6s]',
        className,
      )}
    />
  );
  // Spin lives on the image; the pulse breathes on a wrapper so the two
  // animations compose without fighting over a single transform.
  return pulse ? <span className="inline-block animate-ai-pulse leading-none">{img}</span> : img;
}
