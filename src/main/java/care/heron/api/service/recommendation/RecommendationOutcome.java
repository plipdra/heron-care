package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

import java.util.List;

// A strategy's result, in domain types. The service maps DoctorProfile →
// PublicDoctorResponse and the specialization → its label for the wire DTO.
public record RecommendationOutcome(
        Specialization suggestedSpecialization,
        List<Ranked> doctors
) {
    // The reason is framed around the SPECIALTY's domain, never the patient's
    // condition, and never a numeric score — that's the safety + brand line.
    public record Ranked(DoctorProfile doctor, String reason) {}
}
