package care.heron.api.dto.booking;

import care.heron.api.document.Booking;
import care.heron.api.document.enums.BookingStatus;

import java.time.Instant;

public record BookingResponse(
        String id,
        String patientUserId,
        String doctorUserId,
        Instant startsAt,
        Instant endsAt,
        BookingStatus status,
        String concernNote,
        String meetingLink,
        Instant createdAt
) {
    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getPatientUserId(),
                booking.getDoctorUserId(),
                booking.getStartsAt(),
                booking.getEndsAt(),
                booking.getStatus(),
                booking.getConcernNote(),
                booking.getMeetingLink(),
                booking.getCreatedAt());
    }
}
