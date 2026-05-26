package care.heron.api.controller;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.dto.common.PageResponse;
import care.heron.api.dto.doctor.DoctorProfileResponse;
import care.heron.api.dto.doctor.PublicDoctorResponse;
import care.heron.api.dto.doctor.UpdateDoctorProfileRequest;
import care.heron.api.service.DoctorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;

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
}
