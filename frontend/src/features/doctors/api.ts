import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Specialization } from './specializations';

export type PublicDoctor = {
  id: string;
  // The doctor's userId — the booking target (conflict + idempotency key on it).
  userId: string;
  name: string;
  bio: string | null;
  specialization: Specialization;
  specializationLabel: string | null;
  profilePictureUrl: string;
  yearsOfExperience: number | null;
};

// Times are the doctor's local wall-clock: startTime/endTime as "HH:mm[:ss]" in
// the availability timeZone; blocked ranges are absolute UTC instants.
export type WeeklyEntry = { dayOfWeek: string; startTime: string; endTime: string };
export type BlockedRange = { startsAt: string; endsAt: string; reason: string | null };
export type Availability = {
  timeZone: string;
  weeklySchedule: WeeklyEntry[];
  blockedRanges: BlockedRange[];
};

export type DoctorProfile = PublicDoctor & {
  defaultMeetingLink: string | null;
  availability: Availability | null;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type DoctorListParams = {
  specialization?: Specialization | null;
  search?: string;
  page?: number;
  size?: number;
};

export function useDoctors(params: DoctorListParams) {
  return useQuery({
    queryKey: ['doctors', 'list', params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.specialization) search.set('specialization', params.specialization);
      if (params.search && params.search.length > 0) search.set('search', params.search);
      search.set('page', String(params.page ?? 0));
      search.set('size', String(params.size ?? 12));
      return apiFetch<PageResponse<PublicDoctor>>(
        `/api/doctors?${search.toString()}`,
        { skipAuth: true },
      );
    },
  });
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: ['doctors', 'one', id],
    queryFn: () =>
      apiFetch<PublicDoctor>(`/api/doctors/${id}`, { skipAuth: true }),
    enabled: !!id,
  });
}

export function useMyDoctorProfile() {
  return useQuery({
    queryKey: ['doctors', 'me'],
    queryFn: () => apiFetch<DoctorProfile>('/api/doctors/me'),
  });
}

// null clears a field (full replace from the editor); undefined would be dropped
// from the JSON and leave the value unchanged.
type UpdateDoctorProfileBody = {
  name?: string | null;
  bio?: string | null;
  specialization?: string | null;
  defaultMeetingLink?: string | null;
  yearsOfExperience?: number | null;
};

export function useUpdateMyDoctorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDoctorProfileBody) =>
      apiFetch<DoctorProfile>('/api/doctors/me', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['doctors', 'me'], data);
      queryClient.invalidateQueries({ queryKey: ['doctors', 'list'] });
    },
  });
}

type UpdateAvailabilityBody = {
  weeklySchedule: { dayOfWeek: string; startTime: string; endTime: string }[];
  blockedRanges: { startsAt: string; endsAt: string; reason?: string }[];
};

// Whole-replace of the doctor's schedule + time-off. A schedule change re-derives
// the doctor's offerable slots, so drop the cached slot snapshots (any doctor's —
// the key is scoped by profile id, and a blunt invalidate is cheap here).
export function useUpdateMyAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAvailabilityBody) =>
      apiFetch<DoctorProfile>('/api/doctors/me/availability', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['doctors', 'me'], data);
      queryClient.invalidateQueries({ queryKey: ['doctor-slots'] });
    },
  });
}

// Profile-picture bytes live on the role-agnostic /api/profile-pictures/me
// endpoint (keyed off the JWT principal), shared with the patient side. The
// doctor variant just invalidates ['doctors','me'] so the editor's preview
// re-resolves after a save. The picture now also feeds the public doctor card
// via /api/doctors/{id}/picture, so a fresh upload shows up in discovery too.
export function useUploadMyDoctorPicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dataUrl: string) =>
      apiFetch<void>('/api/profile-pictures/me', {
        method: 'PUT',
        body: JSON.stringify({ dataUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors', 'me'] });
    },
  });
}

export function useDeleteMyDoctorPicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/profile-pictures/me', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors', 'me'] });
    },
  });
}
