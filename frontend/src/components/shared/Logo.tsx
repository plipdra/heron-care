type LogoProps = {
  className?: string;
  size?: number;
};

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <img
      src="/brand/heron.svg"
      alt="Heron"
      width={size}
      height={size}
      className={className}
    />
  );
}
