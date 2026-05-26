package care.heron.api.dto.doctor;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

// Public response shape — excludes email and defaultMeetingLink. Used by the
// unauthenticated discovery endpoints so leaking private fields is impossible
// by shape, not by hope.
public record PublicDoctorResponse(
        String id,
        String name,
        String bio,
        Specialization specialization,
        String specializationLabel,
        String profilePicturePath,
        Integer yearsOfExperience
) {
    public static PublicDoctorResponse from(DoctorProfile profile) {
        return new PublicDoctorResponse(
                profile.getId(),
                profile.getName(),
                profile.getBio(),
                profile.getSpecialization(),
                profile.getSpecialization() != null
                        ? profile.getSpecialization().displayName()
                        : null,
                profile.getProfilePicturePath(),
                profile.getYearsOfExperience());
    }
}
