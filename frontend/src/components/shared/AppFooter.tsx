export function AppFooter() {
  return (
    <footer className="bg-surface">
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
