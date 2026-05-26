package care.heron.api.service;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.User;
import care.heron.api.document.enums.Specialization;
import care.heron.api.document.enums.UserRole;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.repository.PatientProfileRepository;
import care.heron.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// Seeds demo accounts on first startup so the deployed URL has browseable data
// immediately. Idempotent — only runs when the users collection is empty.
// Demo password is documented in the README; these accounts exist for evaluator
// login, not production users.
@Component
@RequiredArgsConstructor
@Slf4j
public class SeedRunner implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "Demo123!";

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("[seed] users collection not empty, skipping seed");
            return;
        }
        log.info("[seed] seeding demo accounts");
        seedPatient("patient.demo@heron.care", "Demo Patient");
        seedDoctor("dr.reyes@heron.care", "Maria Reyes, MD",
                Specialization.CARDIOLOGY,
                "Board-certified cardiologist with 12 years' experience in preventive care and arrhythmia management.",
                12);
        seedDoctor("dr.tan@heron.care", "Joshua Tan, MD",
                Specialization.CARDIOLOGY,
                "Interventional cardiologist focused on coronary disease and post-procedure follow-up.",
                8);
        seedDoctor("dr.santos@heron.care", "Anna Santos, MD",
                Specialization.DERMATOLOGY,
                "Clinical dermatologist specialising in eczema, acne, and skin cancer screening.",
                10);
        seedDoctor("dr.lim@heron.care", "Daniel Lim, MD",
                Specialization.PEDIATRICS,
                "Paediatrician working with newborn-to-teen care; developmental and adolescent medicine.",
                14);
        seedDoctor("dr.cruz@heron.care", "Patricia Cruz, MD",
                Specialization.INTERNAL_MEDICINE,
                "Internist seeing adults for chronic disease management, hypertension, and diabetes.",
                16);
        seedDoctor("dr.garcia@heron.care", "Miguel Garcia, MD",
                Specialization.PSYCHIATRY,
                "Adult psychiatrist; anxiety, depression, ADHD, and medication management.",
                9);
        log.info("[seed] complete - 1 patient, 6 doctors across 5 specialties");
    }

    private void seedPatient(String email, String name) {
        User user = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                .role(UserRole.PATIENT)
                .build());
        patientProfileRepository.save(PatientProfile.builder()
                .userId(user.getId())
                .name(name)
                .build());
    }

    private void seedDoctor(
            String email, String name, Specialization specialization, String bio, int years) {
        User user = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                .role(UserRole.DOCTOR)
                .build());
        doctorProfileRepository.save(DoctorProfile.builder()
                .userId(user.getId())
                .name(name)
                .specialization(specialization)
                .bio(bio)
                .yearsOfExperience(years)
                .build());
    }
}
