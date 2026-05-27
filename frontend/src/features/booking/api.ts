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
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  concernNote: string | null;
  joinable: boolean;
  meetingLink: string | null;
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

// The 409 ProblemDetail carries up to three nearest-open slots on an extension
// field that isn't part of the shared ProblemDetail shape. Read it in one place
// so the field name lives once, not scattered across casts.
export function extractAlternatives(err: unknown): Slot[] {
  if (!(err instanceof ApiError) || err.status !== 409) return [];
  const slots = (err.problem as { alternativeSlots?: Slot[] } | undefined)
    ?.alternativeSlots;
  return Array.isArray(slots) ? slots : [];
}
