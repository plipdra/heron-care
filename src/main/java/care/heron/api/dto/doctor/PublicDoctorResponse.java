package care.heron.api.dto.doctor;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

// Public response shape — excludes email and defaultMeetingLink. Used by the
// unauthenticated discovery endpoints so leaking private fields is impossible
// by shape, not by hope. profilePictureUrl points at the auth-gated byte
// endpoint; the picture itself is private even though the doctor's other
// public fields are not.
//
// userId is the booking target: the booking POST keys conflict detection and
// idempotency on the doctor's userId, so discovery must surface it. It is an
// opaque identifier already implied by profilePictureUrl's path — exposing it
// as a first-class field is cleaner than having the client parse the URL.
public record PublicDoctorResponse(
        String id,
        String userId,
        String name,
        String bio,
        Specialization specialization,
        String specializationLabel,
        String profilePictureUrl,
        Integer yearsOfExperience
) {
    public static PublicDoctorResponse from(DoctorProfile profile) {
        return new PublicDoctorResponse(
                profile.getId(),
                profile.getUserId(),
                profile.getName(),
                profile.getBio(),
                profile.getSpecialization(),
                profile.getSpecialization() != null
                        ? profile.getSpecialization().displayName()
                        : null,
                "/api/profile-pictures/" + profile.getUserId(),
                profile.getYearsOfExperience());
    }
}
