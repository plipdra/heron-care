import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The joinable-appointment affordance: a copyable link preview + the Join button.
// Shared between the booking-success view and the appointments list so the
// stateful copy behaviour (clipboard, the 2s copied state, the icon swap, the
// a11y label) lives in exactly one place and can't drift between the two.
// Renders as a fragment; the caller owns the surrounding layout and helper copy.
export function MeetingLinkActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. a non-secure context) — the link stays
      // visible for manual copy, so fail quietly rather than surfacing an error.
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{link}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Link copied' : 'Copy link'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {copied ? (
            <Check className="h-5 w-5 text-success" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </button>
      </div>
      <Button asChild>
        <a href={link} target="_blank" rel="noopener noreferrer">
          Join your appointment
        </a>
      </Button>
    </>
  );
}
