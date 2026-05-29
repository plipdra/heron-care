package care.heron.api.dto.booking;

import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
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
        // The prescribing doctor's PRC / PTR license numbers, surfaced so the
        // patient can render the printable visit summary and prescription. Null
        // for a since-departed doctor. Not secret — MVP-flavor demo credentials.
        String doctorPrcLicenseNo,
        String doctorPtrNo,
        Instant startsAt,
        Instant endsAt,
        BookingStatus status,
        String concernNote,
        boolean joinable,
        String meetingLink,
        // The slot this booking was most recently moved away from, or null if it
        // has never been rescheduled. Drives the muted "Moved from …" card line.
        // Only the latest leg is surfaced — the full trail stays server-side.
        Instant rescheduledFrom,
        Instant createdAt
) {
    public static PatientBookingResponse of(
            Booking booking, PublicDoctorResponse doctor, DoctorProfile doctorProfile,
            boolean joinable) {
        Instant rescheduledFrom = null;
        var history = booking.getRescheduledHistory();
        if (history != null && !history.isEmpty()) {
            rescheduledFrom = history.get(history.size() - 1).getPreviousStartsAt();
        }
        return new PatientBookingResponse(
                booking.getId(),
                booking.getDoctorUserId(),
                doctor != null ? doctor.id() : null,
                doctor != null ? doctor.name() : null,
                doctor != null ? doctor.specializationLabel() : null,
                doctorProfile != null ? doctorProfile.getPrcLicenseNo() : null,
                doctorProfile != null ? doctorProfile.getPtrNo() : null,
                booking.getStartsAt(),
                booking.getEndsAt(),
                booking.getStatus(),
                booking.getConcernNote(),
                joinable,
                joinable ? booking.getMeetingLink() : null,
                rescheduledFrom,
                booking.getCreatedAt());
    }
}
