package care.heron.api.dto.doctor;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;

// Public response shape — excludes email and defaultMeetingLink. Used by the
// unauthenticated discovery endpoints so leaking private fields is impossible
// by shape, not by hope. profilePictureUrl points at the public, published-doctor
// avatar route (/api/doctors/{id}/picture) — a doctor's headshot is part of their
// public listing. Patient avatars remain auth-gated + private on
// /api/profile-pictures/{userId}; that route is intentionally not used here, so a
// patient avatar can never be addressed through a doctor's public response.
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
                "/api/doctors/" + profile.getId() + "/picture",
                profile.getYearsOfExperience());
    }
}
