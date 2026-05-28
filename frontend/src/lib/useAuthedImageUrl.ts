import { useEffect, useState } from 'react';
import { apiFetchBlob } from './api';

// Profile-picture bytes sit behind an authenticated endpoint, so a plain
// <img src="/api/..."> can't load them (it can't attach our bearer token).
// This fetches the bytes with auth and returns an object URL to render, or null
// when there's no picture / the caller isn't authorized — so callers fall back
// to initials cleanly. The object URL is revoked on change/unmount.
export function useAuthedImageUrl(path: string | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setObjectUrl(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    apiFetchBlob(path)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (active) setObjectUrl(null);
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);

  return objectUrl;
}
