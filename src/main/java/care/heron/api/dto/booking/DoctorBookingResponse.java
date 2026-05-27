package care.heron.api.dto.booking;

import care.heron.api.document.Booking;
import care.heron.api.document.enums.BookingStatus;

import java.time.Instant;

// Read-time enriched view for a DOCTOR's appointment list. Deliberately carries
// the patient's NAME only — never medicalHistory or demographics. Full patient
// context is fetched separately, per booking, when the doctor opens a consult
// (info-minimization: a list payload must not ship every patient's medical PII).
//
// meetingLink is exposed ONLY when joinable, identical to the patient side, so a
// past/cancelled consult never surfaces a live link to a static shared room.
public record DoctorBookingResponse(
        String id,
        String patientUserId,
        String patientName,
        Instant startsAt,
        Instant endsAt,
        BookingStatus status,
        String concernNote,
        boolean joinable,
        String meetingLink,
        Instant createdAt
) {
    public static DoctorBookingResponse of(Booking booking, String patientName, boolean joinable) {
        return new DoctorBookingResponse(
                booking.getId(),
                booking.getPatientUserId(),
                patientName,
                booking.getStartsAt(),
                booking.getEndsAt(),
                booking.getStatus(),
                booking.getConcernNote(),
                joinable,
                joinable ? booking.getMeetingLink() : null,
                booking.getCreatedAt());
    }
}
