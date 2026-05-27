package care.heron.api.dto.booking;

import care.heron.api.document.Booking;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.dto.doctor.PublicDoctorResponse;

import java.time.Instant;

// Read-time enriched view for a patient's appointment list. The booking document
// references the doctor by id only (profile metadata changes independently — see
// Booking), so the doctor's display fields are resolved at read time and flattened
// here. Null doctor fields are valid: a historical booking to a since-departed
// doctor still renders.
//
// meetingLink is exposed ONLY when joinable — an elapsed/cancelled/completed
// booking returns a null link so a stale shared room can't be re-entered, and a
// tampered client clock can't resurrect a link the server never sent.
public record PatientBookingResponse(
        String id,
        String doctorUserId,
        String doctorProfileId,
        String doctorName,
        String doctorSpecializationLabel,
        Instant startsAt,
        Instant endsAt,
        BookingStatus status,
        String concernNote,
        boolean joinable,
        String meetingLink,
        Instant createdAt
) {
    public static PatientBookingResponse of(
            Booking booking, PublicDoctorResponse doctor, boolean joinable) {
        return new PatientBookingResponse(
                booking.getId(),
                booking.getDoctorUserId(),
                doctor != null ? doctor.id() : null,
                doctor != null ? doctor.name() : null,
                doctor != null ? doctor.specializationLabel() : null,
                booking.getStartsAt(),
                booking.getEndsAt(),
                booking.getStatus(),
                booking.getConcernNote(),
                joinable,
                joinable ? booking.getMeetingLink() : null,
                booking.getCreatedAt());
    }
}
