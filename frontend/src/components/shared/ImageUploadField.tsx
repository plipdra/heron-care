import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { resizeImage } from '@/lib/imageResize';
import { cn } from '@/lib/utils';

type ImageUploadFieldProps = {
  label: string;
  description?: string;
  // Current picture to display: either an already-uploaded URL pointing
  // at the byte endpoint, or a freshly-encoded data URL pending save.
  currentUrl?: string | null;
  pendingDataUrl?: string | null;
  // Fires with the new data URL when the user picks a file. Fires with
  // null when the user clicks Remove.
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
};

export function ImageUploadField({
  label,
  description,
  currentUrl,
  pendingDataUrl,
  onChange,
  disabled,
  className,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = pendingDataUrl ?? currentUrl ?? null;
  const hasImage = preview !== null;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      onChange(resized.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the image.');
    } finally {
      setBusy(false);
      // Reset so picking the same file again still triggers onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    setError(null);
    onChange(null);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-primary-tint">
          {hasImage ? (
            <img
              src={preview ?? undefined}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                // Missing picture or 401 — hide the broken icon. The
                // parent decides what to render in the empty state.
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs text-ink-muted">No photo</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleChange}
            disabled={disabled || busy}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
            >
              {busy ? 'Processing…' : hasImage ? 'Replace' : 'Upload'}
            </Button>
            {hasImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || busy}
              >
                Remove
              </Button>
            )}
          </div>
          {description && (
            <p className="text-xs text-ink-muted">{description}</p>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
