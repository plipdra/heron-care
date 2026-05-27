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

export type DoctorProfile = PublicDoctor & {
  defaultMeetingLink: string | null;
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

type UpdateDoctorProfileBody = {
  name?: string;
  bio?: string;
  specialization?: string;
  defaultMeetingLink?: string;
  yearsOfExperience?: number;
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
