package care.heron.api.controller;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.ProfilePicture;
import care.heron.api.document.enums.Specialization;
import care.heron.api.dto.common.PageResponse;
import care.heron.api.dto.doctor.DoctorProfileResponse;
import care.heron.api.dto.doctor.PublicDoctorResponse;
import care.heron.api.dto.doctor.UpdateAvailabilityRequest;
import care.heron.api.dto.doctor.UpdateDoctorProfileRequest;
import care.heron.api.service.DoctorService;
import care.heron.api.service.ProfilePictureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;
    private final ProfilePictureService profilePictureService;

    // PUBLIC — guest browsing surface for the marketplace-auth flow.
    @GetMapping
    public PageResponse<PublicDoctorResponse> list(
            @RequestParam(required = false) Specialization specialization,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        Page<DoctorProfile> page = doctorService.listPublic(specialization, search, pageable);
        return PageResponse.from(page.map(PublicDoctorResponse::from));
    }

    // PUBLIC — single doctor profile, also part of the guest discovery flow.
    @GetMapping("/{id}")
    public PublicDoctorResponse get(@PathVariable String id) {
        return PublicDoctorResponse.from(doctorService.getPublic(id));
    }

    // PUBLIC — a published doctor's avatar bytes. Scoped by doctor *profile id* (not
    // userId), so this route structurally cannot address a patient: a patient has no
    // doctor_profiles row, and an unpublished / incomplete doctor 404s. A doctor's
    // headshot is part of their public marketplace listing, so unlike the patient
    // avatar route (auth-gated, Cache-Control: private) this one is public. It's
    // marked no-cache (revalidate every request, keyed on the ETag) so a re-uploaded
    // photo shows to guests immediately; the ETag still lets an unchanged fetch 304.
    @GetMapping("/{id}/picture")
    public ResponseEntity<byte[]> picture(@PathVariable String id) {
        DoctorProfile doctor = doctorService.getPublic(id);
        return profilePictureService.get(doctor.getUserId())
                .map(this::toPublicResponse)
                .orElse(ResponseEntity.notFound().build());
    }

    private ResponseEntity<byte[]> toPublicResponse(ProfilePicture picture) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(picture.getContentType()))
                .cacheControl(CacheControl.noCache().cachePublic())
                .eTag("\"" + picture.getUpdatedAt().toEpochMilli() + "\"")
                .lastModified(picture.getUpdatedAt())
                .body(picture.getData());
    }

    // Doctor's own profile — IDOR-safe by route shape: no {id} param, userId comes
    // straight from the JWT principal.
    @GetMapping("/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public DoctorProfileResponse getMine(@AuthenticationPrincipal String userId) {
        return DoctorProfileResponse.from(doctorService.getMine(userId));
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public DoctorProfileResponse updateMine(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UpdateDoctorProfileRequest request) {
        DoctorService.UpdateDoctorProfileCommand command = new DoctorService.UpdateDoctorProfileCommand(
                request.name(),
                request.bio(),
                request.specialization(),
                request.defaultMeetingLink(),
                request.yearsOfExperience());
        return DoctorProfileResponse.from(doctorService.updateMine(userId, command));
    }

    // Whole-replace of the doctor's own schedule + time-off. IDOR-safe by route
    // shape — no {id}, the target is the JWT principal and the request carries no
    // identity field. timeZone is intentionally not accepted (immutable for MVP).
    @PutMapping("/me/availability")
    @PreAuthorize("hasRole('DOCTOR')")
    public DoctorProfileResponse updateMyAvailability(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UpdateAvailabilityRequest request) {
        List<Availability.WeeklyScheduleEntry> weekly = request.weeklySchedule().stream()
                .map(entry -> Availability.WeeklyScheduleEntry.builder()
                        .dayOfWeek(entry.dayOfWeek())
                        .startTime(entry.startTime())
                        .endTime(entry.endTime())
                        .build())
                .toList();
        List<Availability.BlockedRange> blocked = request.blockedRanges() == null
                ? List.of()
                : request.blockedRanges().stream()
                        .map(range -> Availability.BlockedRange.builder()
                                .startsAt(range.startsAt())
                                .endsAt(range.endsAt())
                                .reason(range.reason())
                                .build())
                        .toList();
        DoctorService.UpdateAvailabilityCommand command =
                new DoctorService.UpdateAvailabilityCommand(weekly, blocked);
        return DoctorProfileResponse.from(doctorService.updateMyAvailability(userId, command));
    }
}
