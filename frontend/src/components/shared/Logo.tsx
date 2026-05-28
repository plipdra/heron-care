type LogoProps = {
  className?: string;
  size?: number;
  // 'duotone' (black heron + blue crescent) is the full mark for larger surfaces.
  // 'mono' (all-blue) reads crisp at small sizes where the duotone's fine black
  // detail muddies — see BRAND.md §7 favicon strategy. The header uses 'mono'.
  variant?: 'duotone' | 'mono';
};

export function Logo({ className, size = 32, variant = 'duotone' }: LogoProps) {
  const src = variant === 'mono' ? '/brand/heron-mono.svg' : '/brand/heron.svg';
  return <img src={src} alt="Heron" width={size} height={size} className={className} />;
}
