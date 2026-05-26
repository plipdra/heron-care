package care.heron.api.controller;

import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
import care.heron.api.dto.booking.BookingResponse;
import care.heron.api.dto.booking.CreateBookingRequest;
import care.heron.api.exception.SlotTakenException;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.service.BookingService;
import care.heron.api.service.SlotService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@Validated
public class BookingController {

    private static final int ALTERNATIVE_HORIZON_DAYS = 7;
    private static final int ALTERNATIVE_LIMIT = 3;
    private static final String UUID_REGEX =
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private final BookingService bookingService;
    private final SlotService slotService;
    private final DoctorProfileRepository doctorProfileRepository;
    private final Clock clock;

    @PostMapping
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<BookingResponse> create(
            @AuthenticationPrincipal String patientUserId,
            @RequestHeader(name = "Idempotency-Key")
            @NotBlank(message = "Idempotency-Key header is required.")
            @Pattern(regexp = UUID_REGEX,
                    message = "Idempotency-Key must be a UUID.")
            String idempotencyKey,
            @Valid @RequestBody CreateBookingRequest request) {
        Booking booking = bookingService.create(new BookingService.CreateBookingCommand(
                patientUserId,
                request.doctorUserId(),
                request.startsAt(),
                request.concernNote(),
                idempotencyKey));
        return ResponseEntity.status(HttpStatus.CREATED).body(BookingResponse.from(booking));
    }

    // Local handler so we can reach SlotService and DoctorProfileRepository
    // to compute alternative slots — the 409 body is the moment we earn the
    // healthcare-UX trust signal, not a place to skimp.
    @ExceptionHandler(SlotTakenException.class)
    public ResponseEntity<ProblemDetail> handleSlotTaken(SlotTakenException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Slot taken");
        problem.setType(URI.create("https://heron.care/errors/slot-taken"));
        problem.setProperty("requestId", MDC.get("requestId"));

        Optional<DoctorProfile> doctor = doctorProfileRepository.findByUserId(ex.getDoctorUserId());
        if (doctor.isPresent()) {
            Instant now = clock.instant();
            Instant horizon = now.plus(ALTERNATIVE_HORIZON_DAYS, ChronoUnit.DAYS);
            List<Map<String, Instant>> alternatives = slotService.computeFor(doctor.get(), now, horizon)
                    .stream()
                    .limit(ALTERNATIVE_LIMIT)
                    .map(slot -> Map.of(
                            "startsAt", slot.startsAt(),
                            "endsAt", slot.endsAt()))
                    .toList();
            problem.setProperty("alternativeSlots", alternatives);
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problem);
    }
}
