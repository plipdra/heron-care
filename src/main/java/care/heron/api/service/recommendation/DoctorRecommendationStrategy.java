package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;

import java.util.List;

// A strategy ranks a pre-fetched candidate doctor list against a patient's
// concern. It never touches the repository — the service fetches candidates once
// and passes them in, so both the rules and (later) the LLM strategy rank over
// the SAME set and return the SAME shape, making the swap invisible to the UX.
public interface DoctorRecommendationStrategy {

    RecommendationOutcome recommend(RecommendationQuery query, List<DoctorProfile> candidates);
}
