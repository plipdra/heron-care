package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Availability.BlockedRange;
import care.heron.api.document.Availability.WeeklyScheduleEntry;
import care.heron.api.document.Booking;
import care.heron.api.document.ConsultationRecord;
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
import java.util.ArrayList;
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

    public Page<Booking> listForDoctor(String doctorUserId, Pageable pageable) {
        return bookingRepository.findByDoctorUserIdOrderByStartsAtDesc(doctorUserId, pageable);
    }

    // Resolves the booking behind a request to read a patient's medical context,
    // with the stricter access rules that PII path needs:
    //   - missing booking, OR caller is neither its patient nor its doctor -> 404
    //     (NOT 403): a 403 would confirm "this bookingId exists but isn't yours",
    //     letting a doctor probe which bookings belong to colleagues.
    //   - CANCELLED booking -> 404: a cancelled consult has no clinical reason to
    //     keep exposing the patient's history.
    // The caller then loads the patient profile for booking.patientUserId.
    public Booking getBookingForPatientContext(String bookingId, String callerUserId) {
        return bookingRepository.findById(bookingId)
                .filter(b -> Objects.equals(b.getPatientUserId(), callerUserId)
                        || Objects.equals(b.getDoctorUserId(), callerUserId))
                .filter(b -> b.getStatus() != BookingStatus.CANCELLED)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
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

    // Shared write gate for notes (draft or finalize). Guards:
    //   - only the booking's DOCTOR may write (not the patient — a patient must
    //     not author their own diagnosis). Not-the-doctor/missing -> 404, never
    //     403, so a doctor can't probe colleagues' bookings.
    //   - only from CONFIRMED (a cancelled or already-finalized consult is closed
    //     to edits — finalize is the lock).
    //   - only once the consult has started (you can't document a visit that
    //     hasn't happened).
    private Booking loadWritableConsult(String bookingId, String doctorUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .filter(b -> Objects.equals(b.getDoctorUserId(), doctorUserId))
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new IllegalArgumentException("This consultation can no longer be edited.");
        }
        if (booking.getStartsAt() == null || clock.instant().isBefore(booking.getStartsAt())) {
            throw new IllegalArgumentException(
                    "You can write notes once the consultation has started.");
        }
        return booking;
    }

    // Save notes as a private draft — the booking stays CONFIRMED and the record
    // is NOT finalized, so the read gate keeps it hidden from the patient. The
    // doctor can reopen and keep editing.
    public Booking saveDraftConsultation(String bookingId, String doctorUserId, ConsultationRecord record) {
        Booking booking = loadWritableConsult(bookingId, doctorUserId);
        record.setFinalizedAt(null);
        booking.setConsultationRecord(record);
        return bookingRepository.save(booking);
    }

    // Finalize: write the record, stamp finalizedAt, and mark the booking
    // COMPLETED. This is the lock — the write gate above rejects further edits
    // once status leaves CONFIRMED. @Version guards the finalize/cancel race.
    public Booking finalizeConsultation(String bookingId, String doctorUserId, ConsultationRecord record) {
        Booking booking = loadWritableConsult(bookingId, doctorUserId);
        record.setFinalizedAt(clock.instant());
        booking.setConsultationRecord(record);
        booking.setStatus(BookingStatus.COMPLETED);
        return bookingRepository.save(booking);
    }

    // Read a consultation record, booking-scoped. The DOCTOR on the booking reads
    // it at any stage (including their own un-finalized draft, to resume editing);
    // the PATIENT reads it only once finalized (COMPLETED). Anything else -> 404.
    public ConsultationRecord getConsultationRecordForCaller(String bookingId, String callerUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .filter(b -> b.getConsultationRecord() != null)
                .filter(b -> Objects.equals(b.getDoctorUserId(), callerUserId)
                        || (Objects.equals(b.getPatientUserId(), callerUserId)
                                && b.getStatus() == BookingStatus.COMPLETED))
                .orElseThrow(() -> new ResourceNotFoundException("Consultation record", bookingId));
        return booking.getConsultationRecord();
    }

    // Patient-only loader for the mutation paths (cancel/reschedule). Unlike
    // getByIdForCaller (which lets the doctor through and throws 403), this
    // collapses not-the-patient AND missing to 404 — a patient must never get a
    // 403 that confirms "this bookingId exists but isn't yours". The booking's
    // doctorUserId is read FROM the document on every downstream use, never taken
    // from the request, so a patient can't redirect a reschedule onto another
    // doctor's calendar. Guards shared by both mutations: must still be CONFIRMED
    // (a cancelled/completed consult is closed to changes) and must not have
    // started yet (you can't move or cancel a visit already underway).
    private Booking loadOwnUpcomingBooking(String bookingId, String patientUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .filter(b -> Objects.equals(b.getPatientUserId(), patientUserId))
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new IllegalArgumentException("Only an upcoming appointment can be changed.");
        }
        if (booking.getStartsAt() == null || !booking.getStartsAt().isAfter(clock.instant())) {
            throw new IllegalArgumentException(
                    "This appointment has already started and can no longer be changed.");
        }
        return booking;
    }

    // Cancel an upcoming booking. Free any time before it starts: status ->
    // CANCELLED, cancelledAt stamped. No slot is deleted; because the conflict
    // index is filtered to status=CONFIRMED, the freed slot becomes re-bookable
    // immediately. @Version guards a cancel/finalize race (mapped to 409).
    public Booking cancelBooking(String bookingId, String patientUserId) {
        Booking booking = loadOwnUpcomingBooking(bookingId, patientUserId);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(clock.instant());
        return bookingRepository.save(booking);
    }

    // Move an upcoming booking to a new slot, in place — same booking id, same
    // concernNote, same meetingLink. The prior slot is appended to
    // rescheduledHistory so the trail is preserved across repeated moves.
    //
    // Three things make this distinct from create():
    //   - No-op short-circuit: rescheduling to the same instant returns the
    //     booking untouched, so we don't trip the unique index against ourselves.
    //   - The new slot is validated against the SAME doctor (read from the
    //     booking) — half-hour boundary, future, in schedule, not blocked.
    //   - The save() is wrapped in its OWN DuplicateKey catch that maps straight
    //     to SlotTakenException. We deliberately do NOT reuse create()'s catch,
    //     which is entangled with idempotency-replay re-querying that has no
    //     meaning here (a PATCH is resource-idempotent on its own).
    public Booking rescheduleBooking(String bookingId, String patientUserId, Instant newStartsAt) {
        Booking booking = loadOwnUpcomingBooking(bookingId, patientUserId);

        if (Objects.equals(booking.getStartsAt(), newStartsAt)) {
            return booking; // No move requested — nothing to validate or save.
        }

        DoctorProfile doctor = doctorProfileRepository.findByUserId(booking.getDoctorUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor user", booking.getDoctorUserId()));
        validateSlot(doctor, newStartsAt);

        List<Booking.RescheduledFrom> history = booking.getRescheduledHistory() == null
                ? new ArrayList<>()
                : new ArrayList<>(booking.getRescheduledHistory());
        history.add(Booking.RescheduledFrom.builder()
                .previousStartsAt(booking.getStartsAt())
                .previousEndsAt(booking.getEndsAt())
                .rescheduledAt(clock.instant())
                .build());

        booking.setStartsAt(newStartsAt);
        booking.setEndsAt(newStartsAt.plus(SLOT_DURATION_MINUTES, ChronoUnit.MINUTES));
        booking.setRescheduledHistory(history);

        try {
            return bookingRepository.save(booking);
        } catch (DuplicateKeyException ex) {
            // The new slot was taken by another CONFIRMED booking on this doctor.
            throw new SlotTakenException(booking.getDoctorUserId(), newStartsAt);
        }
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
