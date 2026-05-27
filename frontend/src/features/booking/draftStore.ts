// Booking handoff across the guest -> login round-trip.
//
// A logged-out visitor can browse and pick a slot; auth is required only at
// commitment. We stash the in-progress selection here, send them through the
// auth modal, then rehydrate it on the way back. Deliberately minimal:
//
//   - NO patient identity. The server derives the patient from the JWT subject;
//     a client-stored identity would be a value the server must never trust.
//   - NO idempotency key. The key is minted fresh AFTER resume — a key created
//     pre-auth and replayed post-auth couples two different logical sessions.
//   - Schema-versioned, so a shape change can't crash on an old stored draft.
//   - Short TTL: a half-finished booking is only meaningful for a few minutes;
//     a day-old slot is almost certainly gone.

const STORAGE_KEY = 'heron:booking-draft';
const SCHEMA_VERSION = 1;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export type BookingDraft = {
  doctorProfileId: string;
  doctorUserId: string;
  startsAt: string;
  endsAt: string;
  concernNote: string;
};

type StoredDraft = BookingDraft & {
  schemaVersion: number;
  createdAt: number;
};

export function setDraft(draft: BookingDraft): void {
  const stored: StoredDraft = {
    ...draft,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Private-mode / quota failures are non-fatal: the booking simply won't
    // resume automatically. Don't break the auth flow over it.
  }
}

// Returns the draft only if it is well-formed, current-schema, unexpired, and
// for the doctor being viewed. Anything else is discarded as it's read.
export function takeDraftFor(doctorProfileId: string): BookingDraft | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: StoredDraft | null = null;
  try {
    parsed = JSON.parse(raw) as StoredDraft;
  } catch {
    clearDraft();
    return null;
  }

  const expired = !parsed || Date.now() - parsed.createdAt > TTL_MS;
  const wrongSchema = !parsed || parsed.schemaVersion !== SCHEMA_VERSION;
  if (!parsed || expired || wrongSchema) {
    clearDraft();
    return null;
  }

  // A draft for a different doctor isn't ours to consume here; leave it for
  // that doctor's page (the TTL will reap it otherwise).
  if (parsed.doctorProfileId !== doctorProfileId) return null;

  clearDraft();
  return {
    doctorProfileId: parsed.doctorProfileId,
    doctorUserId: parsed.doctorUserId,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    concernNote: parsed.concernNote,
  };
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
