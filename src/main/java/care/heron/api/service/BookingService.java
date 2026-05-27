package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Availability.BlockedRange;
import care.heron.api.document.Availability.WeeklyScheduleEntry;
import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.exception.IdempotencyKeyReusedException;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.exception.SlotTakenException;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.DoctorProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

// Load-bearing showcase piece. Three invariants this service defends:
//
//   1. A doctor cannot be double-booked at the same instant. Enforced by
//      a Mongo unique partial index on (doctorUserId, startsAt) filtered
//      to status=CONFIRMED — see DatabaseInitializer. On DuplicateKey
//      we throw SlotTakenException (mapped to 409). Cancelled bookings
//      do not block re-booking because the partial filter excludes them.
//
//   2. Booking creation is idempotent under retry. Same Idempotency-Key
//      from the same patient returns the existing booking, never a
//      duplicate. Enforced by a sparse unique index on
//      (patientUserId, idempotencyKey). On replay we additionally
//      verify the SHA-256 of the canonical request body — same key
//      with a different body is 422, not a silent return of the
//      original. Doing idempotency wrong is worse than not doing it.
//
//   3. The slot the patient picks must actually be a slot. Half-hour
//      boundary in the doctor's local time, not in the past, inside
//      weeklySchedule, not in any blockedRange. Invalid time → 400.
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final long SLOT_DURATION_MINUTES = SlotService.SLOT_DURATION_MINUTES;

    private final BookingRepository bookingRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final Clock clock;

    public Page<Booking> listForPatient(String patientUserId, Pageable pageable) {
        return bookingRepository.findByPatientUserIdOrderByStartsAtDesc(patientUserId, pageable);
    }

    // A booking is joinable only while it is still a future, confirmed slot.
    // The meeting link is a static shared room, so an elapsed booking must never
    // surface a live "join" — re-entering after the slot risks landing in a room
    // the doctor is now using with a different patient. Past, cancelled, and
    // completed bookings are never joinable. No CONFIRMED->COMPLETED job exists
    // yet (that lands with consultation notes), so this time check is what keeps
    // an elapsed-but-still-CONFIRMED booking from showing a stale link.
    public boolean isJoinable(Booking booking) {
        return booking.getStatus() == BookingStatus.CONFIRMED
                && booking.getEndsAt() != null
                && booking.getEndsAt().isAfter(clock.instant());
    }

    // Ownership check is layer 2 of authz: role gating happens upstream
    // (@PreAuthorize), but only the patient who booked it and the doctor
    // who'll see them may read a specific booking.
    public Booking getByIdForCaller(String bookingId, String callerUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
        if (!Objects.equals(booking.getPatientUserId(), callerUserId)
                && !Objects.equals(booking.getDoctorUserId(), callerUserId)) {
            throw new AccessDeniedException("You can only view your own bookings.");
        }
        return booking;
    }

    public Booking create(CreateBookingCommand command) {
        String bodyHash = canonicalBodyHash(command);

        // Fast path: idempotent replay before any insert attempt.
        Optional<Booking> existing = bookingRepository
                .findByPatientUserIdAndIdempotencyKey(command.patientUserId(), command.idempotencyKey());
        if (existing.isPresent()) {
            return replayOrReject(existing.get(), bodyHash);
        }

        DoctorProfile doctor = doctorProfileRepository.findByUserId(command.doctorUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor user", command.doctorUserId()));
        validateSlot(doctor, command.startsAt());

        Booking booking = Booking.builder()
                .patientUserId(command.patientUserId())
                .doctorUserId(command.doctorUserId())
                .startsAt(command.startsAt())
                .endsAt(command.startsAt().plus(SLOT_DURATION_MINUTES, ChronoUnit.MINUTES))
                .status(BookingStatus.CONFIRMED)
                .concernNote(command.concernNote())
                .meetingLink(doctor.getDefaultMeetingLink())
                .idempotencyKey(command.idempotencyKey())
                .idempotencyKeyBodyHash(bodyHash)
                .build();

        try {
            return bookingRepository.save(booking);
        } catch (DuplicateKeyException ex) {
            // Race between the fast-path lookup and this insert. Re-query under
            // the idempotency constraint; if it now matches, this was an
            // idempotency replay that lost the race. Otherwise the conflict was
            // on (doctorUserId, startsAt) — slot taken.
            Optional<Booking> raceWinner = bookingRepository
                    .findByPatientUserIdAndIdempotencyKey(
                            command.patientUserId(), command.idempotencyKey());
            if (raceWinner.isPresent()) {
                return replayOrReject(raceWinner.get(), bodyHash);
            }
            throw new SlotTakenException(command.doctorUserId(), command.startsAt());
        }
    }

    private Booking replayOrReject(Booking existing, String requestBodyHash) {
        if (!Objects.equals(existing.getIdempotencyKeyBodyHash(), requestBodyHash)) {
            throw new IdempotencyKeyReusedException();
        }
        return existing;
    }

    private void validateSlot(DoctorProfile doctor, Instant startsAt) {
        if (startsAt == null) {
            throw new IllegalArgumentException("startsAt is required.");
        }
        if (!startsAt.isAfter(clock.instant())) {
            throw new IllegalArgumentException("startsAt must be in the future.");
        }
        if (startsAt.getEpochSecond() % (SLOT_DURATION_MINUTES * 60) != 0
                || startsAt.getNano() != 0) {
            throw new IllegalArgumentException(
                    "startsAt must align to a " + SLOT_DURATION_MINUTES + "-minute boundary.");
        }
        Availability availability = doctor.getAvailability();
        if (availability == null || availability.getTimeZone() == null
                || availability.getWeeklySchedule() == null) {
            throw new IllegalArgumentException("Doctor has no published availability.");
        }
        ZoneId zone = ZoneId.of(availability.getTimeZone());
        LocalDateTime local = startsAt.atZone(zone).toLocalDateTime();
        Instant endsAt = startsAt.plus(SLOT_DURATION_MINUTES, ChronoUnit.MINUTES);

        WeeklyScheduleEntry entry = availability.getWeeklySchedule().stream()
                .filter(e -> e.getDayOfWeek() == local.getDayOfWeek())
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "The doctor does not see patients on " + local.getDayOfWeek() + "."));
        if (local.toLocalTime().isBefore(entry.getStartTime())
                || !local.toLocalTime().plusMinutes(SLOT_DURATION_MINUTES).isBefore(entry.getEndTime().plusSeconds(1))
                || local.toLocalTime().plusMinutes(SLOT_DURATION_MINUTES).isAfter(entry.getEndTime())) {
            throw new IllegalArgumentException(
                    "Slot is outside the doctor's working hours that day.");
        }

        List<BlockedRange> blocked = availability.getBlockedRanges();
        if (blocked != null) {
            for (BlockedRange range : blocked) {
                if (range.getStartsAt() == null || range.getEndsAt() == null) continue;
                if (startsAt.isBefore(range.getEndsAt()) && endsAt.isAfter(range.getStartsAt())) {
                    throw new IllegalArgumentException(
                            "Slot overlaps a time the doctor has blocked off.");
                }
            }
        }
    }

    // Deterministic, order-independent hash of the booking inputs so a
    // patient re-sending the same body with the same Idempotency-Key
    // produces an identical hash and replays cleanly.
    private String canonicalBodyHash(CreateBookingCommand command) {
        String canonical = "doctorUserId=" + nullSafe(command.doctorUserId())
                + "|startsAt=" + nullSafe(command.startsAt())
                + "|concernNote=" + nullSafe(command.concernNote());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available on this JVM.", ex);
        }
    }

    private static String nullSafe(Object value) {
        return value == null ? "" : value.toString();
    }

    public record CreateBookingCommand(
            String patientUserId,
            String doctorUserId,
            Instant startsAt,
            String concernNote,
            String idempotencyKey) {}
}
