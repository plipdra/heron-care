package care.heron.api.repository;

import care.heron.api.document.Booking;
import care.heron.api.document.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends MongoRepository<Booking, String> {

    Optional<Booking> findByPatientUserIdAndIdempotencyKey(String patientUserId, String idempotencyKey);

    // Used by SlotService to subtract slots that already have a booking.
    // Single $in over many doctor ids keeps the list view N+1-safe.
    List<Booking> findByDoctorUserIdInAndStatusAndStartsAtBetween(
            List<String> doctorUserIds,
            BookingStatus status,
            Instant from,
            Instant to);

    List<Booking> findByDoctorUserIdAndStatusAndStartsAtBetween(
            String doctorUserId,
            BookingStatus status,
            Instant from,
            Instant to);

    // Reminder sweep: CONFIRMED bookings entering the next-hour window that
    // haven't been reminded yet. reminderSentAt is the idempotency marker.
    List<Booking> findByStatusAndReminderSentAtIsNullAndStartsAtBetween(
            BookingStatus status, Instant from, Instant to);

    Page<Booking> findByPatientUserIdOrderByStartsAtDesc(String patientUserId, Pageable pageable);

    Page<Booking> findByDoctorUserIdOrderByStartsAtDesc(String doctorUserId, Pageable pageable);
}
