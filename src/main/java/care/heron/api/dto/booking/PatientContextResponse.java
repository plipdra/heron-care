package care.heron.api.dto.booking;

import care.heron.api.document.PatientProfile;

import java.time.LocalDate;

// The patient context a doctor reads before a consult: demographics, contact,
// and the medical history the patient chose to share. Returned ONLY from the
// booking-scoped endpoint (GET /api/bookings/{id}/patient), which verifies the
// caller is the doctor (or patient) on that booking before this is built — so
// this PII is only ever assembled for someone authorized to that consult.
//
// A deliberately separate shape from PatientProfileResponse: no id, no
// profilePictureUrl (the doctor view uses initials). Every field is nullable —
// a patient who left fields blank still renders, as "Not provided".
public record PatientContextResponse(
        String name,
        LocalDate birthday,
        Double weightKg,
        Double heightCm,
        String contactNumber,
        String medicalHistory
) {
    public static PatientContextResponse from(PatientProfile profile) {
        return new PatientContextResponse(
                profile.getName(),
                profile.getBirthday(),
                profile.getWeightKg(),
                profile.getHeightCm(),
                profile.getContactNumber(),
                profile.getMedicalHistory());
    }

    // The patient has a booking but no profile row yet — render an empty context
    // rather than a 404, so the doctor sees "Not provided", not an error.
    public static PatientContextResponse empty() {
        return new PatientContextResponse(null, null, null, null, null, null);
    }
}
