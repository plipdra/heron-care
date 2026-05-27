package care.heron.api.controller;

import care.heron.api.document.Booking;
import care.heron.api.document.ConsultationRecord;
import care.heron.api.document.DoctorProfile;
import care.heron.api.dto.booking.BookingResponse;
import care.heron.api.dto.booking.ConsultationNotesRequest;
import care.heron.api.dto.booking.ConsultationRecordResponse;
import care.heron.api.dto.booking.CreateBookingRequest;
import care.heron.api.dto.booking.DoctorBookingResponse;
import care.heron.api.dto.booking.PatientBookingResponse;
import care.heron.api.dto.booking.PatientContextResponse;
import care.heron.api.dto.common.PageResponse;
import care.heron.api.dto.doctor.PublicDoctorResponse;
import care.heron.api.exception.SlotTakenException;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.service.BookingService;
import care.heron.api.service.DoctorService;
import care.heron.api.service.PatientService;
import care.heron.api.service.SlotService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@Validated
@Slf4j
public class BookingController {

    private static final int ALTERNATIVE_HORIZON_DAYS = 7;
    private static final int ALTERNATIVE_LIMIT = 3;
    private static final String UUID_REGEX =
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private final BookingService bookingService;
    private final DoctorService doctorService;
    private final PatientService patientService;
    private final SlotService slotService;
    private final DoctorProfileRepository doctorProfileRepository;
    private final Clock clock;

    // Patient's own booking history, most-recent first via the helper index on
    // (patientUserId, startsAt desc). Each row is enriched at read time with the
    // doctor's current display fields (resolved in one batch query, not N
    // lookups) and a server-computed `joinable` flag that gates the meeting link.
    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    public PageResponse<PatientBookingResponse> listMine(
            @AuthenticationPrincipal String patientUserId,
            @PageableDefault(size = 20, sort = "startsAt") Pageable pageable) {
        Page<Booking> page = bookingService.listForPatient(patientUserId, pageable);
        Set<String> doctorUserIds = page.getContent().stream()
                .map(Booking::getDoctorUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, PublicDoctorResponse> doctors = doctorService.publicByUserIds(doctorUserIds);
        return PageResponse.from(page.map(booking -> PatientBookingResponse.of(
                booking,
                doctors.get(booking.getDoctorUserId()),
                bookingService.isJoinable(booking))));
    }

    // Single booking — either party can read it. Service layer enforces the
    // ownership check; @PreAuthorize allows both roles through to that gate.
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public BookingResponse get(
            @AuthenticationPrincipal String callerUserId,
            @PathVariable String id) {
        return BookingResponse.from(bookingService.getByIdForCaller(id, callerUserId));
    }

    // Doctor's appointment list — their own consults (doctor = JWT subject, no
    // id param, so a doctor can't list a colleague's). Enriched at read time with
    // the patient's NAME only via one batched lookup; medical context is fetched
    // separately, per booking, by the endpoint below.
    @GetMapping("/doctor/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public PageResponse<DoctorBookingResponse> listForDoctor(
            @AuthenticationPrincipal String doctorUserId,
            @PageableDefault(size = 20, sort = "startsAt") Pageable pageable) {
        Page<Booking> page = bookingService.listForDoctor(doctorUserId, pageable);
        Set<String> patientUserIds = page.getContent().stream()
                .map(Booking::getPatientUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, String> names = patientService.namesByUserIds(patientUserIds);
        return PageResponse.from(page.map(booking -> DoctorBookingResponse.of(
                booking,
                names.get(booking.getPatientUserId()),
                bookingService.isJoinable(booking))));
    }

    // Patient context for one booking — what the doctor reads before the consult.
    // Booking-scoped: getBookingForPatientContext verifies the caller is the
    // booking's doctor (or patient) and collapses not-owner/missing/cancelled to
    // 404. Reading the patient's medical history is audit-logged so access is
    // reconstructable. A booking whose patient never filled a profile returns an
    // empty context (all nulls), not an error.
    @GetMapping("/{id}/patient")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public PatientContextResponse getPatientContext(
            @AuthenticationPrincipal String callerUserId,
            @PathVariable String id) {
        Booking booking = bookingService.getBookingForPatientContext(id, callerUserId);
        log.info("patient_context_read requestId={} caller={} bookingId={} patient={}",
                MDC.get("requestId"), callerUserId, id, booking.getPatientUserId());
        return patientService.findByUserId(booking.getPatientUserId())
                .map(PatientContextResponse::from)
                .orElseGet(PatientContextResponse::empty);
    }

    // Doctor saves consultation notes. finalise=false is a private draft (status
    // stays CONFIRMED, hidden from the patient); finalise=true writes SOAP notes
    // + prescription, locks the record, marks the booking COMPLETED, and shares
    // it with the patient. Doctor-only and booking-scoped (enforced in the
    // service); the write is audit-logged. Empty prescription rows are dropped.
    @PutMapping("/{id}/notes")
    @PreAuthorize("hasRole('DOCTOR')")
    public ConsultationRecordResponse saveNotes(
            @AuthenticationPrincipal String doctorUserId,
            @PathVariable String id,
            @Valid @RequestBody ConsultationNotesRequest request) {
        List<ConsultationRecord.PrescriptionItem> items = request.prescription() == null
                ? List.of()
                : request.prescription().stream()
                        .filter(i -> i.medication() != null && !i.medication().isBlank())
                        .map(i -> ConsultationRecord.PrescriptionItem.builder()
                                .medication(i.medication())
                                .dosage(i.dosage())
                                .instructions(i.instructions())
                                .build())
                        .toList();
        ConsultationRecord record = ConsultationRecord.builder()
                .subjective(request.subjective())
                .objective(request.objective())
                .assessment(request.assessment())
                .plan(request.plan())
                .prescription(items)
                .build();
        Booking booking = request.finalise()
                ? bookingService.finalizeConsultation(id, doctorUserId, record)
                : bookingService.saveDraftConsultation(id, doctorUserId, record);
        log.info("consultation_{} requestId={} caller={} bookingId={} patient={}",
                request.finalise() ? "finalized" : "draft_saved",
                MDC.get("requestId"), doctorUserId, id, booking.getPatientUserId());
        return ConsultationRecordResponse.from(booking.getConsultationRecord());
    }

    // Read the finalized consultation record — either party on the booking.
    // Booking-scoped 404-collapse in the service; reading is audit-logged.
    @GetMapping("/{id}/notes")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public ConsultationRecordResponse getNotes(
            @AuthenticationPrincipal String callerUserId,
            @PathVariable String id) {
        ConsultationRecord record = bookingService.getConsultationRecordForCaller(id, callerUserId);
        log.info("consultation_notes_read requestId={} caller={} bookingId={}",
                MDC.get("requestId"), callerUserId, id);
        return ConsultationRecordResponse.from(record);
    }

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
