package care.heron.api.service;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.User;
import care.heron.api.document.enums.Specialization;
import care.heron.api.document.enums.UserRole;
import care.heron.api.exception.EmailAlreadyExistsException;
import care.heron.api.exception.InvalidCredentialsException;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.repository.PatientProfileRepository;
import care.heron.api.repository.UserRepository;
import care.heron.api.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResult registerPatient(String email, String password, String name) {
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        User user = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(UserRole.PATIENT)
                .build());
        patientProfileRepository.save(PatientProfile.builder()
                .userId(user.getId())
                .name(name)
                .build());
        return issueTokens(user);
    }

    public AuthResult registerDoctor(
            String email, String password, String name, Specialization specialization,
            String prcLicenseNo, String ptrNo) {
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        User user = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(UserRole.DOCTOR)
                .build());
        doctorProfileRepository.save(DoctorProfile.builder()
                .userId(user.getId())
                .name(name)
                .specialization(specialization)
                // The signup form pre-fills these; generate a fallback if either is
                // blank so a doctor always has numbers for the printable documents.
                .prcLicenseNo(orGenerated(prcLicenseNo, 7))
                .ptrNo(orGenerated(ptrNo, 7))
                .build());
        return issueTokens(user);
    }

    // Returns the supplied value, or a random numeric string of the given length
    // when blank. MVP flavor only — not a verified credential.
    private static String orGenerated(String supplied, int digits) {
        if (supplied != null && !supplied.isBlank()) {
            return supplied.trim();
        }
        StringBuilder sb = new StringBuilder();
        java.util.concurrent.ThreadLocalRandom rnd = java.util.concurrent.ThreadLocalRandom.current();
        for (int i = 0; i < digits; i++) {
            sb.append(rnd.nextInt(10));
        }
        return sb.toString();
    }

    public AuthResult login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return issueTokens(user);
    }

    public AuthResult refresh(String refreshToken) {
        Jws<Claims> jws = jwtService.parse(refreshToken)
                .orElseThrow(InvalidCredentialsException::new);
        Claims claims = jws.getPayload();
        if (!jwtService.isRefreshToken(claims)) {
            throw new InvalidCredentialsException();
        }
        String userId = claims.getSubject();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return issueTokens(user);
    }

    private AuthResult issueTokens(User user) {
        return new AuthResult(
                jwtService.generateAccess(user),
                jwtService.generateRefresh(user),
                user.getId(),
                user.getRole());
    }

    public record AuthResult(
            String accessToken,
            String refreshToken,
            String userId,
            UserRole role) {}
}
