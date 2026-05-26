package care.heron.api.dto.patient;

import care.heron.api.document.PatientProfile;

import java.time.LocalDate;

// Patient's own profile response. profilePictureUrl points at the auth-gated
// byte endpoint; clients render via <img onError={fallback}> so a missing
// picture surfaces as initials rather than a broken icon.
public record PatientProfileResponse(
        String id,
        String userId,
        String name,
        LocalDate birthday,
        Double weightKg,
        Double heightCm,
        String contactNumber,
        String medicalHistory,
        String profilePictureUrl
) {
    public static PatientProfileResponse from(PatientProfile profile) {
        return new PatientProfileResponse(
                profile.getId(),
                profile.getUserId(),
                profile.getName(),
                profile.getBirthday(),
                profile.getWeightKg(),
                profile.getHeightCm(),
                profile.getContactNumber(),
                profile.getMedicalHistory(),
                "/api/profile-pictures/" + profile.getUserId());
    }
}
