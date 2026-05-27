package care.heron.api.service;

import care.heron.api.document.Availability;
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
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Map;

// Seeds demo accounts on first startup so the deployed URL has browseable data
// immediately. Idempotent — only runs when the users collection is empty.
// Demo password is documented in the README; these accounts exist for evaluator
// login, not production users.
//
// @Order(2) so this runs after DatabaseInitializer (@Order(1)) — the unique
// index on users.email must exist before we insert.
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class SeedRunner implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "Demo123!";

    // Static per-doctor video room links for the demo. They are placeholder
    // Google Meet URLs (no real rooms behind them) — the consultation join
    // surface is intentionally an external link, not a built-in video pipe.
    private static final Map<String, String> DOCTOR_MEETING_LINKS = Map.of(
            "dr.reyes@heron.care", "https://meet.google.com/qpz-hwkm-rva",
            "dr.tan@heron.care", "https://meet.google.com/dnf-kxtb-uoe",
            "dr.santos@heron.care", "https://meet.google.com/wjs-mvqd-pkl",
            "dr.lim@heron.care", "https://meet.google.com/hbt-ynra-cgx",
            "dr.cruz@heron.care", "https://meet.google.com/zod-fhqe-mns",
            "dr.garcia@heron.care", "https://meet.google.com/uak-rbwp-tje");

    // Demo patient profile details so the doctor's patient-context view shows
    // realistic content out of the box (fake data — illustrative only).
    private static final String DEMO_PATIENT_EMAIL = "patient.demo@heron.care";
    private static final LocalDate DEMO_PATIENT_BIRTHDAY = LocalDate.of(1991, 3, 12);
    private static final double DEMO_PATIENT_WEIGHT_KG = 68.0;
    private static final double DEMO_PATIENT_HEIGHT_CM = 172.0;
    private static final String DEMO_PATIENT_CONTACT = "+63 917 555 1234";
    private static final String DEMO_PATIENT_HISTORY =
            "Hypertension diagnosed 2022, managed with losartan 50mg daily. "
            + "Mild seasonal asthma (salbutamol inhaler as needed). "
            + "No known drug allergies. Non-smoker. "
            + "Family history: father had a myocardial infarction at 58.";

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("[seed] users collection not empty, skipping account seed");
            backfillMeetingLinks();
            backfillDemoPatient();
            return;
        }
        log.info("[seed] seeding demo accounts");
        seedPatient(DEMO_PATIENT_EMAIL, "Demo Patient");
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
                .birthday(DEMO_PATIENT_BIRTHDAY)
                .weightKg(DEMO_PATIENT_WEIGHT_KG)
                .heightCm(DEMO_PATIENT_HEIGHT_CM)
                .contactNumber(DEMO_PATIENT_CONTACT)
                .medicalHistory(DEMO_PATIENT_HISTORY)
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
                .defaultMeetingLink(DOCTOR_MEETING_LINKS.get(email))
                .availability(Availability.defaultBusinessHours())
                .build());
    }

    // Backfills meeting links onto doctors seeded before the links existed.
    // Idempotent: only touches profiles whose link is missing, so it is safe
    // to run on every startup.
    private void backfillMeetingLinks() {
        int updated = 0;
        for (DoctorProfile profile : doctorProfileRepository.findAll()) {
            if (profile.getDefaultMeetingLink() != null
                    && !profile.getDefaultMeetingLink().isBlank()) {
                continue;
            }
            String link = userRepository.findById(profile.getUserId())
                    .map(User::getEmail)
                    .map(DOCTOR_MEETING_LINKS::get)
                    .orElse(null);
            if (link == null) {
                continue;
            }
            profile.setDefaultMeetingLink(link);
            doctorProfileRepository.save(profile);
            updated++;
        }
        if (updated > 0) {
            log.info("[seed] backfilled meeting links for {} doctor(s)", updated);
        }
    }

    // Populates the Demo Patient profile (seeded before it carried demo details)
    // so the doctor's patient-context view shows real content. Idempotent: only
    // fills when the medical history is still blank.
    private void backfillDemoPatient() {
        userRepository.findByEmail(DEMO_PATIENT_EMAIL)
                .flatMap(user -> patientProfileRepository.findByUserId(user.getId()))
                .filter(p -> p.getMedicalHistory() == null || p.getMedicalHistory().isBlank())
                .ifPresent(p -> {
                    p.setBirthday(DEMO_PATIENT_BIRTHDAY);
                    p.setWeightKg(DEMO_PATIENT_WEIGHT_KG);
                    p.setHeightCm(DEMO_PATIENT_HEIGHT_CM);
                    p.setContactNumber(DEMO_PATIENT_CONTACT);
                    p.setMedicalHistory(DEMO_PATIENT_HISTORY);
                    patientProfileRepository.save(p);
                    log.info("[seed] backfilled demo patient details");
                });
    }
}
