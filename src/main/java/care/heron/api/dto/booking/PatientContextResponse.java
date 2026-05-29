package care.heron.api.dto.booking;

import care.heron.api.document.PatientProfile;
import care.heron.api.document.enums.Sex;

import java.time.LocalDate;
import java.util.List;

// The patient context a doctor reads before a consult: demographics, contact,
// and the structured care profile the patient chose to share. Returned ONLY
// from the booking-scoped endpoint (GET /api/bookings/{id}/patient), which
// verifies the caller is the doctor (or patient) on that booking before this is
// built — so this PII is only ever assembled for someone authorized to that
// consult.
//
// A deliberately separate shape from PatientProfileResponse: no id, no
// profilePictureUrl (the doctor view uses initials). Every field is nullable —
// a patient who left fields blank still renders, as "Not provided".
public record PatientContextResponse(
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
        String notesForDoctor
) {
    public static PatientContextResponse from(PatientProfile profile) {
        return new PatientContextResponse(
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
                profile.getNotesForDoctor());
    }

    // The patient has a booking but no profile row yet — render an empty context
    // rather than a 404, so the doctor sees "Not provided", not an error.
    public static PatientContextResponse empty() {
        return new PatientContextResponse(
                null, null, null, null, null, null, null, null, null, null, null);
    }
}
