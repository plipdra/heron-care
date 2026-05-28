package care.heron.api.dto.recommendation;

import java.util.List;

// `urgent` flips the UI to a calm safety notice (red-flag input) instead of a
// doctor list. Otherwise: the suggested specialty's label as the headline, plus
// ranked doctors. The doctor list is never empty on the non-urgent path — the
// rules strategy always widens to a General Practice fallback.
public record RecommendationResponse(
        boolean urgent,
        String notice,
        String suggestedSpecializationLabel,
        List<RankedDoctorResponse> doctors
) {
    public static RecommendationResponse urgent(String notice) {
        return new RecommendationResponse(true, notice, null, List.of());
    }
}
