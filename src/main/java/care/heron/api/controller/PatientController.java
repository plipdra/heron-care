package care.heron.api.controller;

import care.heron.api.dto.patient.PatientProfileResponse;
import care.heron.api.dto.patient.UpdatePatientProfileRequest;
import care.heron.api.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    // Patient's own profile — IDOR-safe by route shape: no {id} param, userId
    // comes straight from the JWT principal via @AuthenticationPrincipal.
    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    public PatientProfileResponse getMine(@AuthenticationPrincipal String userId) {
        return PatientProfileResponse.from(patientService.getMine(userId));
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    public PatientProfileResponse updateMine(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UpdatePatientProfileRequest request) {
        PatientService.UpdatePatientProfileCommand command = new PatientService.UpdatePatientProfileCommand(
                request.name(),
                request.birthday(),
                request.weightKg(),
                request.heightCm(),
                request.contactNumber(),
                request.medicalHistory());
        return PatientProfileResponse.from(patientService.updateMine(userId, command));
    }
}
