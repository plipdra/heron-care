package care.heron.api.controller;

import care.heron.api.dto.auth.AuthResponse;
import care.heron.api.dto.auth.LoginRequest;
import care.heron.api.dto.auth.RefreshRequest;
import care.heron.api.dto.auth.RegisterDoctorRequest;
import care.heron.api.dto.auth.RegisterPatientRequest;
import care.heron.api.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register/patient")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registerPatient(@Valid @RequestBody RegisterPatientRequest request) {
        return AuthResponse.from(
                authService.registerPatient(request.email(), request.password(), request.name()));
    }

    // TODO: production should verify the doctor's PRC (Professional Regulation Commission)
    // licence against the PRC verification service before activating the account. For the
    // 5-day MVP, doctor signup is self-serve per the spec literal. See README → Future Work.
    @PostMapping("/register/doctor")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registerDoctor(@Valid @RequestBody RegisterDoctorRequest request) {
        return AuthResponse.from(authService.registerDoctor(
                request.email(),
                request.password(),
                request.name(),
                request.specialization()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return AuthResponse.from(authService.login(request.email(), request.password()));
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return AuthResponse.from(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout() {
        // Day 1: stateless refresh tokens, so logout is a client-side discard.
        // Day 2 (W1): write the refresh token's jti to revoked_refresh_tokens
        // (Mongo TTL index expires entries at the token's natural expiry).
    }
}
