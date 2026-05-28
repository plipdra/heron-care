import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PublicDoctor } from '@/features/doctors/api';

export type RankedDoctor = { doctor: PublicDoctor; reason: string };

export type RecommendationResponse = {
  // true = red-flag input → show the calm safety notice instead of doctors.
  urgent: boolean;
  notice: string | null;
  suggestedSpecializationLabel: string | null;
  doctors: RankedDoctor[];
};

export type RecommendationRequest = {
  concern: string;
  forWhom?: string;
  duration?: string;
};

// A mutation (input-driven POST), guest-accessible (skipAuth). The backend always
// returns a usable body — LLM or its rules fallback — so the client just renders
// whatever ranked list comes back; it only handles the HTTP call itself failing.
export function useRecommend() {
  return useMutation({
    mutationFn: (body: RecommendationRequest) =>
      apiFetch<RecommendationResponse>('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify(body),
        skipAuth: true,
      }),
  });
}
