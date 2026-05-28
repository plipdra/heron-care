package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

import java.util.List;

// A strategy's result, in domain types. The service maps DoctorProfile →
// PublicDoctorResponse and the specialization → its label for the wire DTO.
//
// `emergency` lets a strategy signal that the concern reads as a medical
// emergency (the LLM can catch a described heart attack/stroke the keyword
// screen misses). It rides alongside the deterministic red-flag screen in the
// service; either one short-circuits to the safety notice.
public record RecommendationOutcome(
        Specialization suggestedSpecialization,
        List<Ranked> doctors,
        boolean emergency
) {
    public static RecommendationOutcome of(Specialization suggested, List<Ranked> doctors) {
        return new RecommendationOutcome(suggested, doctors, false);
    }

    public static RecommendationOutcome emergencyOutcome() {
        return new RecommendationOutcome(null, List.of(), true);
    }

    // The reason is framed around the SPECIALTY's domain, never the patient's
    // condition, and never a numeric score — that's the safety + brand line.
    public record Ranked(DoctorProfile doctor, String reason) {}
}
