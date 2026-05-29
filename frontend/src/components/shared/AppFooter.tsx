export function AppFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-surface-raised">
      {/* Faint crescent corner accent — the brand mark, quietly present. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 opacity-[0.05]"
        style={{
          backgroundImage: 'url(/brand/crescent-blue.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="container mx-auto px-4 py-6 text-sm text-ink-muted">
        <p className="text-xs">
          If this is a medical emergency, call 911 (or 117 in the
          Philippines). Heron is not for emergencies.
        </p>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Heron Care</span>
          <span className="font-medium text-ink">Care, watched closely.</span>
        </div>
      </div>
    </footer>
  );
}
