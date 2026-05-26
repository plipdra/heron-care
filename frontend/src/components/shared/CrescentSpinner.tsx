import { cn } from '@/lib/utils';

type SpinnerProps = {
  className?: string;
  size?: number;
};

// Brand-pattern loader — rotating crescent. Slower-than-default 1.6s rotation
// because the brand voice is calm (BRAND.md §8 — stillness beats motion).
export function CrescentSpinner({ className, size = 24 }: SpinnerProps) {
  return (
    <img
      src="/brand/crescent-blue.svg"
      alt=""
      role="status"
      aria-label="Loading"
      width={size}
      height={size}
      className={cn('animate-spin [animation-duration:1.6s]', className)}
    />
  );
}
