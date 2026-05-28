package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.User;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.document.enums.Specialization;
import care.heron.api.document.enums.UserRole;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.repository.PatientProfileRepository;
import care.heron.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Seeds demo accounts and bookings so the deployed URL has rich, browseable data
// immediately. Demo password is documented in the README; these accounts exist
// for evaluator login, not production users.
//
// @Order(2) so this runs after DatabaseInitializer (@Order(1)) — the unique
// indexes must exist before we insert.
//
// Idempotency model:
//   - doctors: ensured on every startup (each created only if missing), so a
//     specialty newly added to the roster appears on the next restart without
//     wiping or duplicating existing doctors; meeting links backfilled.
//   - patients: ensured on every startup (each created only if missing).
//   - bookings: seeded only when the bookings collection is empty, so a normal
//     restart never clobbers a booking made live. Setting the SEED_RESET=true
//     env var deletes existing bookings first — a deliberate one-shot reset for
//     refreshing the demo, never on by default.
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class SeedRunner implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "Demo123!";
    private static final long SLOT_MINUTES = 30;

    // Demo bookings are authored in the doctors' local zone so they render in
    // sensible daytime hours for the demo viewer, not the small hours of the night.
    private static final ZoneId DEMO_ZONE = ZoneId.of("Asia/Manila");

    // Static per-doctor video room links for the demo. They are placeholder
    // Google Meet URLs (no real rooms behind them) — the consultation join
    // surface is intentionally an external link, not a built-in video pipe.
    private static final Map<String, String> DOCTOR_MEETING_LINKS = Map.ofEntries(
            Map.entry("dr.reyes@heron.care", "https://meet.google.com/qpz-hwkm-rva"),
            Map.entry("dr.tan@heron.care", "https://meet.google.com/dnf-kxtb-uoe"),
            Map.entry("dr.santos@heron.care", "https://meet.google.com/wjs-mvqd-pkl"),
            Map.entry("dr.lim@heron.care", "https://meet.google.com/hbt-ynra-cgx"),
            Map.entry("dr.cruz@heron.care", "https://meet.google.com/zod-fhqe-mns"),
            Map.entry("dr.garcia@heron.care", "https://meet.google.com/uak-rbwp-tje"),
            Map.entry("dr.flores@heron.care", "https://meet.google.com/fke-mzqd-rtp"),
            Map.entry("dr.mendoza@heron.care", "https://meet.google.com/mvx-cqwn-bzl"),
            Map.entry("dr.romero@heron.care", "https://meet.google.com/rno-tjpa-cdk"),
            Map.entry("dr.ocampo@heron.care", "https://meet.google.com/oqz-hdrl-mnk"),
            Map.entry("dr.velasco@heron.care", "https://meet.google.com/vbe-fkqp-trn"));

    // The demo doctor roster — at least one doctor per specialization the
    // recommendation engine can suggest, so every suggested specialty resolves to a
    // real bookable doctor (never "We suggest Orthopedics" over an empty result).
    private static final List<DoctorSpec> DOCTORS = List.of(
            new DoctorSpec("dr.reyes@heron.care", "Maria Reyes, MD", Specialization.CARDIOLOGY,
                    "Board-certified cardiologist with 12 years' experience in preventive care and arrhythmia management.", 12),
            new DoctorSpec("dr.tan@heron.care", "Joshua Tan, MD", Specialization.CARDIOLOGY,
                    "Interventional cardiologist focused on coronary disease and post-procedure follow-up.", 8),
            new DoctorSpec("dr.santos@heron.care", "Anna Santos, MD", Specialization.DERMATOLOGY,
                    "Clinical dermatologist specialising in eczema, acne, and skin cancer screening.", 10),
            new DoctorSpec("dr.lim@heron.care", "Daniel Lim, MD", Specialization.PEDIATRICS,
                    "Paediatrician working with newborn-to-teen care; developmental and adolescent medicine.", 14),
            new DoctorSpec("dr.cruz@heron.care", "Patricia Cruz, MD", Specialization.INTERNAL_MEDICINE,
                    "Internist seeing adults for chronic disease management, hypertension, and diabetes.", 16),
            new DoctorSpec("dr.garcia@heron.care", "Miguel Garcia, MD", Specialization.PSYCHIATRY,
                    "Adult psychiatrist; anxiety, depression, ADHD, and medication management.", 9),
            new DoctorSpec("dr.flores@heron.care", "Elena Flores, MD", Specialization.GENERAL_PRACTICE,
                    "Family physician and first point of contact for everyday illness, check-ups, and referrals.", 11),
            new DoctorSpec("dr.mendoza@heron.care", "Carlo Mendoza, MD", Specialization.ORTHOPEDICS,
                    "Orthopaedic surgeon treating joint, bone, and sports injuries — from sprains to fractures.", 13),
            new DoctorSpec("dr.romero@heron.care", "Sofia Romero, MD", Specialization.NEUROLOGY,
                    "Neurologist managing headaches and migraine, dizziness, seizures, and nerve disorders.", 10),
            new DoctorSpec("dr.ocampo@heron.care", "Bianca Ocampo, MD", Specialization.OB_GYN,
                    "OB-GYN providing prenatal care, women's health, and reproductive medicine.", 12),
            new DoctorSpec("dr.velasco@heron.care", "Ramon Velasco, MD", Specialization.ENDOCRINOLOGY,
                    "Endocrinologist treating thyroid disorders, diabetes, and hormonal imbalances.", 15));

    // 11 demo patients. A couple are deliberately sparse (jose, mark) so the
    // doctor's patient-context view also exercises the "Not provided" handling.
    private static final List<PatientSpec> PATIENTS = List.of(
            new PatientSpec("patient.demo@heron.care", "Demo Patient",
                    LocalDate.of(1991, 3, 12), 68.0, 172.0, "+63 917 555 1234",
                    "Hypertension diagnosed 2022, managed with losartan 50mg daily. "
                    + "Mild seasonal asthma (salbutamol inhaler as needed). No known drug "
                    + "allergies. Non-smoker. Family history: father had a myocardial "
                    + "infarction at 58."),
            new PatientSpec("juan.cruz@heron.care", "Juan dela Cruz",
                    LocalDate.of(1985, 7, 22), 82.0, 178.0, "+63 918 222 3344",
                    "Type 2 diabetes since 2019, on metformin. Occasional knee pain. "
                    + "No known allergies."),
            new PatientSpec("maria.santos@heron.care", "Maria Santos",
                    LocalDate.of(1993, 11, 2), 58.0, 161.0, "+63 919 444 5566",
                    "Generalised anxiety, started CBT last year. Lactose intolerant."),
            new PatientSpec("jose.protacio@heron.care", "Jose Protacio",
                    LocalDate.of(1978, 6, 19), null, null, "+63 917 888 1122", null),
            new PatientSpec("ana.reyes@heron.care", "Ana Reyes",
                    LocalDate.of(1990, 1, 30), 64.0, 165.0, "+63 920 333 7788",
                    "Mild persistent asthma. Penicillin allergy (rash)."),
            new PatientSpec("pedro.bautista@heron.care", "Pedro Bautista",
                    LocalDate.of(1965, 9, 14), 90.0, 175.0, "+63 921 555 9900",
                    "Coronary artery disease, stent placed 2021. On aspirin and "
                    + "atorvastatin. Ex-smoker."),
            new PatientSpec("liza.garcia@heron.care", "Liza Garcia",
                    LocalDate.of(1998, 4, 5), 55.0, 158.0, null,
                    "Eczema since childhood. No other concerns."),
            new PatientSpec("mark.villanueva@heron.care", "Mark Villanueva",
                    LocalDate.of(2000, 12, 11), null, null, null, null),
            new PatientSpec("grace.tan@heron.care", "Grace Tan",
                    LocalDate.of(1988, 8, 8), 60.0, 163.0, "+63 922 111 2233",
                    "Postpartum, three months. Breastfeeding. No chronic conditions."),
            new PatientSpec("ramon.aquino@heron.care", "Ramon Aquino",
                    LocalDate.of(1982, 2, 17), 78.0, 170.0, "+63 917 666 4455",
                    "Booking on behalf of his son (age 5). No personal history of note."),
            new PatientSpec("sofia.delosreyes@heron.care", "Sofia delos Reyes",
                    LocalDate.of(1995, 10, 25), 62.0, 167.0, "+63 918 999 0011",
                    "Hypothyroidism, on levothyroxine. Family history of skin cancer."));

    // A spread of bookings across doctors and patients. daysFromNow < 0 is a past
    // (elapsed) consult, > 0 is upcoming. Times per doctor are distinct so the
    // CONFIRMED-conflict unique index is never tripped.
    private static final List<BookingSpec> BOOKINGS = List.of(
            new BookingSpec("juan.cruz@heron.care", "dr.reyes@heron.care", 1, 9, 0,
                    BookingStatus.CONFIRMED, "Chest tightness when I climb stairs, started about a week ago."),
            new BookingSpec("patient.demo@heron.care", "dr.reyes@heron.care", 3, 10, 30,
                    BookingStatus.CONFIRMED, "Follow-up on my blood pressure medication."),
            new BookingSpec("maria.santos@heron.care", "dr.reyes@heron.care", -5, 14, 0,
                    BookingStatus.CONFIRMED, "Heart palpitations in the evenings."),
            new BookingSpec("ana.reyes@heron.care", "dr.tan@heron.care", 2, 11, 0,
                    BookingStatus.CONFIRMED, "Shortness of breath after light activity."),
            new BookingSpec("pedro.bautista@heron.care", "dr.tan@heron.care", -2, 15, 30,
                    BookingStatus.CONFIRMED, "Post-stent follow-up and medication review."),
            new BookingSpec("grace.tan@heron.care", "dr.tan@heron.care", 4, 9, 30,
                    BookingStatus.CANCELLED, "Second opinion on my ECG results."),
            new BookingSpec("liza.garcia@heron.care", "dr.santos@heron.care", 1, 13, 0,
                    BookingStatus.CONFIRMED, "Itchy red rash on both forearms for two weeks."),
            new BookingSpec("mark.villanueva@heron.care", "dr.santos@heron.care", -8, 10, 0,
                    BookingStatus.CONFIRMED, "Persistent acne, would like to discuss treatment options."),
            new BookingSpec("sofia.delosreyes@heron.care", "dr.santos@heron.care", 5, 16, 0,
                    BookingStatus.CONFIRMED, "A mole on my back changed colour — would like it checked."),
            new BookingSpec("ramon.aquino@heron.care", "dr.lim@heron.care", 2, 9, 0,
                    BookingStatus.CONFIRMED, "My 5-year-old has had a fever for three days."),
            new BookingSpec("grace.tan@heron.care", "dr.lim@heron.care", -3, 11, 30,
                    BookingStatus.CONFIRMED, "Newborn weight and feeding check."),
            new BookingSpec("jose.protacio@heron.care", "dr.cruz@heron.care", 1, 14, 30,
                    BookingStatus.CONFIRMED, "Annual check-up and diabetes screening."),
            new BookingSpec("patient.demo@heron.care", "dr.cruz@heron.care", -10, 9, 0,
                    BookingStatus.CONFIRMED, "Persistent fatigue and occasional dizziness."),
            new BookingSpec("juan.cruz@heron.care", "dr.cruz@heron.care", 6, 10, 0,
                    BookingStatus.CONFIRMED, "Reviewing my recent blood test results."),
            new BookingSpec("maria.santos@heron.care", "dr.garcia@heron.care", 2, 15, 0,
                    BookingStatus.CONFIRMED, "Trouble sleeping and persistent anxiety."),
            new BookingSpec("ana.reyes@heron.care", "dr.garcia@heron.care", -4, 16, 30,
                    BookingStatus.CONFIRMED, "Medication review for depression."));

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final BookingRepository bookingRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Override
    public void run(String... args) {
        boolean reset = "true".equalsIgnoreCase(System.getenv("SEED_RESET"));

        ensureDoctors();
        backfillMeetingLinks();
        ensurePatients();
        seedBookings(reset);
    }

    // Creates any demo doctor that doesn't exist yet (matched by email). Idempotent
    // like ensurePatients — so a specialty newly added to DOCTORS appears on the next
    // restart without wiping or duplicating the doctors already on the roster.
    private void ensureDoctors() {
        int created = 0;
        for (DoctorSpec spec : DOCTORS) {
            if (userRepository.findByEmail(spec.email()).isPresent()) {
                continue;
            }
            User user = userRepository.save(User.builder()
                    .email(spec.email())
                    .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                    .role(UserRole.DOCTOR)
                    .build());
            doctorProfileRepository.save(DoctorProfile.builder()
                    .userId(user.getId())
                    .name(spec.name())
                    .specialization(spec.specialization())
                    .bio(spec.bio())
                    .yearsOfExperience(spec.years())
                    .defaultMeetingLink(DOCTOR_MEETING_LINKS.get(spec.email()))
                    .availability(Availability.defaultBusinessHours())
                    .build());
            created++;
        }
        if (created > 0) {
            log.info("[seed] created {} doctor(s)", created);
        }
    }

    // Creates any demo patient that doesn't exist yet. Idempotent — existing
    // profiles (and anything they've edited) are left untouched.
    private void ensurePatients() {
        int created = 0;
        for (PatientSpec spec : PATIENTS) {
            if (userRepository.findByEmail(spec.email()).isPresent()) {
                continue;
            }
            User user = userRepository.save(User.builder()
                    .email(spec.email())
                    .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                    .role(UserRole.PATIENT)
                    .build());
            patientProfileRepository.save(PatientProfile.builder()
                    .userId(user.getId())
                    .name(spec.name())
                    .birthday(spec.birthday())
                    .weightKg(spec.weightKg())
                    .heightCm(spec.heightCm())
                    .contactNumber(spec.contactNumber())
                    .medicalHistory(spec.medicalHistory())
                    .build());
            created++;
        }
        if (created > 0) {
            log.info("[seed] created {} patient(s)", created);
        }
    }

    private void seedBookings(boolean reset) {
        if (reset && bookingRepository.count() > 0) {
            long removed = bookingRepository.count();
            bookingRepository.deleteAll();
            log.info("[seed] SEED_RESET — deleted {} existing booking(s)", removed);
        }
        if (bookingRepository.count() > 0) {
            return; // idempotent: never duplicate or clobber live bookings
        }
        int created = 0;
        for (BookingSpec spec : BOOKINGS) {
            String patientUserId = userRepository.findByEmail(spec.patientEmail())
                    .map(User::getId).orElse(null);
            String doctorUserId = userRepository.findByEmail(spec.doctorEmail())
                    .map(User::getId).orElse(null);
            if (patientUserId == null || doctorUserId == null) {
                continue;
            }
            Instant startsAt = instantAt(spec.daysFromNow(), spec.hour(), spec.minute());
            bookingRepository.save(Booking.builder()
                    .patientUserId(patientUserId)
                    .doctorUserId(doctorUserId)
                    .startsAt(startsAt)
                    .endsAt(startsAt.plus(SLOT_MINUTES, ChronoUnit.MINUTES))
                    .status(spec.status())
                    .concernNote(spec.concernNote())
                    .meetingLink(DOCTOR_MEETING_LINKS.get(spec.doctorEmail()))
                    .idempotencyKey(UUID.randomUUID().toString())
                    .build());
            created++;
        }
        if (created > 0) {
            log.info("[seed] created {} demo booking(s)", created);
        }
    }

    // Backfills meeting links onto doctors seeded before the links existed.
    // Idempotent: only touches profiles whose link is missing.
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

    // A 30-minute slot at the given local (Manila) wall-clock time, daysFromNow
    // from today — so the seeded consults land in daytime for the demo viewer.
    private Instant instantAt(int daysFromNow, int hour, int minute) {
        return ZonedDateTime.of(
                LocalDate.now(clock).plusDays(daysFromNow),
                LocalTime.of(hour, minute),
                DEMO_ZONE).toInstant();
    }

    private record DoctorSpec(
            String email, String name, Specialization specialization, String bio, int years) {}

    private record PatientSpec(
            String email, String name, LocalDate birthday, Double weightKg,
            Double heightCm, String contactNumber, String medicalHistory) {}

    private record BookingSpec(
            String patientEmail, String doctorEmail, int daysFromNow, int hour,
            int minute, BookingStatus status, String concernNote) {}
}
