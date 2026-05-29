import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api';
import type { PageResponse } from '@/features/doctors/api';

export type Slot = { startsAt: string; endsAt: string };

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type CreateBookingRequest = {
  doctorUserId: string;
  startsAt: string;
  concernNote?: string;
};

export type BookingResponse = {
  id: string;
  patientUserId: string;
  doctorUserId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  concernNote: string | null;
  meetingLink: string | null;
  createdAt: string;
};

// Available slots for a doctor. Public, like the rest of discovery, so guests
// can browse times before committing. staleTime 0: a slot list is a live
// snapshot, and a stale one inflates the conflict rate at the moment of intent.
export function useDoctorSlots(doctorProfileId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-slots', doctorProfileId],
    queryFn: () =>
      apiFetch<Slot[]>(`/api/doctors/${doctorProfileId}/slots`, { skipAuth: true }),
    enabled: !!doctorProfileId,
    staleTime: 0,
  });
}

// The caller owns the Idempotency-Key (it must stay stable across a pure retry
// but rotate when the booking body changes), so the mutation takes it as input
// rather than minting one per call.
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      body,
      idempotencyKey,
    }: {
      body: CreateBookingRequest;
      idempotencyKey: string;
    }) =>
      apiFetch<BookingResponse>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
        idempotencyKey,
      }),
    onSuccess: (booking) => {
      // The booked slot is now gone — drop the cached snapshot so the picker
      // reflects reality, and refresh the patient's bookings list if present.
      queryClient.invalidateQueries({ queryKey: ['doctor-slots'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      return booking;
    },
  });
}

// Read-time enriched booking for the patient's appointment list. doctor* fields
// are resolved server-side and may be null (a since-departed doctor). meetingLink
// is present only when joinable (server-gated) — never on past/cancelled bookings.
export type PatientBooking = {
  id: string;
  doctorUserId: string;
  doctorProfileId: string | null;
  doctorName: string | null;
  doctorSpecializationLabel: string | null;
  // The prescribing doctor's PRC / PTR license numbers, for the printable
  // visit summary and prescription. Null for a since-departed doctor.
  doctorPrcLicenseNo: string | null;
  doctorPtrNo: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  concernNote: string | null;
  joinable: boolean;
  meetingLink: string | null;
  // The slot this booking was last moved away from, or null if never rescheduled.
  rescheduledFrom: string | null;
  createdAt: string;
};

// size=50: a single fetch the page sections client-side into upcoming/past.
// Key is ['bookings','me'] so useCreateBooking's invalidation refreshes it for free.
export function useMyBookings() {
  return useQuery({
    queryKey: ['bookings', 'me'],
    queryFn: () => apiFetch<PageResponse<PatientBooking>>('/api/bookings/me?size=50'),
  });
}

// Cancel an upcoming booking (PATCH, no body). On success the patient's list
// refreshes (the card flips to Cancelled, drops the join link) and the doctor's
// freed slot list is dropped so it reappears as bookable. We pass doctorProfileId
// purely to scope that slot invalidation — null when the doctor has since left.
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId }: { bookingId: string; doctorProfileId: string | null }) =>
      apiFetch<BookingResponse>(`/api/bookings/${bookingId}/cancel`, { method: 'PATCH' }),
    onSuccess: (_data, { doctorProfileId }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      if (doctorProfileId) {
        queryClient.invalidateQueries({ queryKey: ['doctor-slots', doctorProfileId] });
      }
    },
  });
}

// Move an upcoming booking to a new slot (PATCH). Same booking id. A 409 carries
// alternativeSlots, read by the dialog via extractAlternatives. On success both
// the freed old slot and the now-taken new slot need to re-derive, so we drop the
// doctor's slot snapshot, plus the patient's bookings list.
export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      startsAt,
    }: {
      bookingId: string;
      startsAt: string;
      doctorProfileId: string | null;
    }) =>
      apiFetch<BookingResponse>(`/api/bookings/${bookingId}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ startsAt }),
      }),
    onSuccess: (_data, { doctorProfileId }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      if (doctorProfileId) {
        queryClient.invalidateQueries({ queryKey: ['doctor-slots', doctorProfileId] });
      }
    },
  });
}

// A doctor's appointment-list row. Carries the patient's NAME only — no medical
// history or demographics (those come from usePatientContext below, per booking).
// meetingLink is present only when joinable, same server gate as the patient side.
export type DoctorBooking = {
  id: string;
  patientUserId: string;
  patientName: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  concernNote: string | null;
  joinable: boolean;
  meetingLink: string | null;
  // The doctor has saved un-finalized notes for this consult (offer "Continue").
  hasDraft: boolean;
  // The slot this consult was last moved away from, or null if never rescheduled.
  rescheduledFrom: string | null;
  createdAt: string;
};

// Key ['bookings','doctor'] — a distinct sibling of the patient ['bookings','me'],
// so the two never collide in the query cache.
export function useDoctorBookings() {
  return useQuery({
    queryKey: ['bookings', 'doctor'],
    queryFn: () => apiFetch<PageResponse<DoctorBooking>>('/api/bookings/doctor/me?size=50'),
  });
}

// The patient's medical context for one booking. Every field nullable — a
// patient who left fields blank still renders ("Not provided").
export type PatientContext = {
  name: string | null;
  birthday: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED' | null;
  sexLabel: string | null;
  weightKg: number | null;
  heightCm: number | null;
  contactNumber: string | null;
  conditions: string[] | null;
  allergies: string[] | null;
  medications: string[] | null;
  notesForDoctor: string | null;
};

// Lazily fetched: `enabled` is false until the doctor opens a booking's context,
// so medical PII is never requested for rows the doctor only skims past.
export function usePatientContext(bookingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['patient-context', bookingId],
    queryFn: () => apiFetch<PatientContext>(`/api/bookings/${bookingId}/patient`),
    enabled: enabled && !!bookingId,
  });
}

// A finalized consultation record (SOAP notes + structured prescription). Read
// only via the booking-scoped notes endpoint, never from a list.
export type PrescriptionItem = {
  medication: string;
  dosage: string | null;
  instructions: string | null;
};

export type ConsultationRecord = {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  prescription: PrescriptionItem[];
  finalizedAt: string | null;
};

export type ConsultationNotesBody = {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  prescription: { medication: string; dosage?: string; instructions?: string }[];
  // false = save a private draft; true = finalize (lock + complete + share).
  finalise: boolean;
};

// Doctor saves consultation notes (draft or finalize). A finalize sets the
// booking to COMPLETED server-side, so we refresh both appointment lists (the
// doctor's, and the patient's — their card flips to Completed and drops the join
// link); a draft refresh keeps the doctor's "Continue notes" state current. We
// also drop the cached record for this booking so a reopen re-fetches it.
export function useSaveConsultationNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, body }: { bookingId: string; body: ConsultationNotesBody }) =>
      apiFetch<ConsultationRecord>(`/api/bookings/${bookingId}/notes`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'doctor'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-notes', bookingId] });
    },
  });
}

// Lazily fetched when someone opens a completed consult's summary — clinical
// notes are never pulled for rows just skimmed past.
export function useConsultationNotes(bookingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['consultation-notes', bookingId],
    queryFn: () => apiFetch<ConsultationRecord>(`/api/bookings/${bookingId}/notes`),
    enabled: enabled && !!bookingId,
  });
}

// The 409 ProblemDetail carries up to three nearest-open slots on an extension
// field that isn't part of the shared ProblemDetail shape. Read it in one place
// so the field name lives once, not scattered across casts.
export function extractAlternatives(err: unknown): Slot[] {
  if (!(err instanceof ApiError) || err.status !== 409) return [];
  const slots = (err.problem as { alternativeSlots?: Slot[] } | undefined)
    ?.alternativeSlots;
  return Array.isArray(slots) ? slots : [];
}
