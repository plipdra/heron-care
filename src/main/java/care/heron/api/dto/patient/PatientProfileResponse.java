package care.heron.api.dto.patient;

import care.heron.api.document.PatientProfile;
import care.heron.api.document.enums.Sex;

import java.time.LocalDate;
import java.util.List;

// Patient's own profile response. profilePictureUrl points at the auth-gated
// byte endpoint; clients render via <img onError={fallback}> so a missing
// picture surfaces as initials rather than a broken icon. The care fields
// (conditions/allergies/medications) are structured lists, replacing the old
// free-text history; sexLabel ships alongside the enum so the client renders a
// human label without re-deriving it.
public record PatientProfileResponse(
        String id,
        String userId,
        String name,
        LocalDate birthday,
        Sex sex,
        String sexLabel,
        Double weightKg,
        Double heightCm,
        String contactNumber,
        List<String> conditions,
        List<String> allergies,
        List<String> medications,
        String notesForDoctor,
        String profilePictureUrl
) {
    public static PatientProfileResponse from(PatientProfile profile) {
        return new PatientProfileResponse(
                profile.getId(),
                profile.getUserId(),
                profile.getName(),
                profile.getBirthday(),
                profile.getSex(),
                profile.getSex() != null ? profile.getSex().displayName() : null,
                profile.getWeightKg(),
                profile.getHeightCm(),
                profile.getContactNumber(),
                profile.getConditions(),
                profile.getAllergies(),
                profile.getMedications(),
                profile.getNotesForDoctor(),
                "/api/profile-pictures/" + profile.getUserId());
    }
}
