package care.heron.api.dto.doctor;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

// Doctor's own profile response — adds defaultMeetingLink which the public shape
// hides. Email lives on the JWT (decoded client-side), so it's not duplicated here.
public record DoctorProfileResponse(
        String id,
        String userId,
        String name,
        String bio,
        Specialization specialization,
        String specializationLabel,
        String profilePictureUrl,
        String defaultMeetingLink,
        Integer yearsOfExperience
) {
    public static DoctorProfileResponse from(DoctorProfile profile) {
        return new DoctorProfileResponse(
                profile.getId(),
                profile.getUserId(),
                profile.getName(),
                profile.getBio(),
                profile.getSpecialization(),
                profile.getSpecialization() != null
                        ? profile.getSpecialization().displayName()
                        : null,
                "/api/profile-pictures/" + profile.getUserId(),
                profile.getDefaultMeetingLink(),
                profile.getYearsOfExperience());
    }
}
