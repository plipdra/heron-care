package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Booking;
import care.heron.api.document.ConsultationRecord;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.User;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.document.enums.Sex;
import care.heron.api.document.enums.Specialization;
import care.heron.api.document.enums.UserRole;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.repository.NotificationRepository;
import care.heron.api.repository.PatientProfileRepository;
import care.heron.api.repository.ProfilePictureRepository;
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
            Map.entry("dr.velasco@heron.care", "https://meet.google.com/vbe-fkqp-trn"),
            Map.entry("dr.domingo@heron.care", "https://meet.google.com/kfp-rbnq-wda"),
            Map.entry("dr.navarro@heron.care", "https://meet.google.com/tcm-jhle-xou"),
            Map.entry("dr.salazar@heron.care", "https://meet.google.com/bgw-nxpd-qle"),
            Map.entry("dr.aguilar@heron.care", "https://meet.google.com/hsv-mkrt-zpa"),
            Map.entry("dr.castillo@heron.care", "https://meet.google.com/dyq-wfbn-rce"),
            Map.entry("dr.delrosario@heron.care", "https://meet.google.com/lpa-zhmk-tne"),
            Map.entry("dr.bernardo@heron.care", "https://meet.google.com/qos-vdcl-rwm"),
            Map.entry("dr.pascual@heron.care", "https://meet.google.com/jne-tqbx-hdc"),
            Map.entry("dr.ramos@heron.care", "https://meet.google.com/wmk-rlfp-aze"),
            Map.entry("dr.torres@heron.care", "https://meet.google.com/cxh-ndtq-bvo"),
            Map.entry("dr.mercado@heron.care", "https://meet.google.com/rpa-jwkm-led"),
            Map.entry("dr.dimaano@heron.care", "https://meet.google.com/zbt-fqnh-mcu"),
            Map.entry("dr.soriano@heron.care", "https://meet.google.com/ynd-kxrp-jba"),
            Map.entry("dr.valdez@heron.care", "https://meet.google.com/hqw-mtlc-rdn"),
            Map.entry("dr.manalo@heron.care", "https://meet.google.com/pkf-bzqn-wae"),
            Map.entry("dr.carpio@heron.care", "https://meet.google.com/dlm-rhtp-ouc"),
            Map.entry("dr.tolentino@heron.care", "https://meet.google.com/vsq-knbw-mfa"),
            Map.entry("dr.padilla@heron.care", "https://meet.google.com/gtr-hpld-zcx"));

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
                    "Endocrinologist treating thyroid disorders, diabetes, and hormonal imbalances.", 15),
            // Depth is weighted to telehealth demand, not in-person volume: behavioral
            // health and the primary-care front doors run deepest (4), the high-fit
            // chronic/cognitive specialties next (3), and the exam- or procedure-heavy
            // specialties stay honestly lean (2). See the recommendation council notes.
            // -- Psychiatry (telehealth's #1 category) -> 4 total
            new DoctorSpec("dr.domingo@heron.care", "Teresa Domingo, MD", Specialization.PSYCHIATRY,
                    "Treats mood and anxiety disorders with CBT-informed medication management; special interest in burnout and work stress.", 13),
            new DoctorSpec("dr.navarro@heron.care", "Rafael Navarro, MD", Specialization.PSYCHIATRY,
                    "Adult ADHD, OCD, and insomnia; favours a collaborative, goal-oriented approach to medication and therapy referral.", 7),
            new DoctorSpec("dr.salazar@heron.care", "Camille Salazar, MD", Specialization.PSYCHIATRY,
                    "Nearly two decades in trauma and PTSD care, including perinatal and postpartum mental health.", 18),
            // -- General Practice (the universal front door / fallback) -> 4 total
            new DoctorSpec("dr.aguilar@heron.care", "Antonio Aguilar, MD", Specialization.GENERAL_PRACTICE,
                    "Everyday illness, preventive screening, and coordinating chronic care across specialties.", 9),
            new DoctorSpec("dr.castillo@heron.care", "Marisol Castillo, MD", Specialization.GENERAL_PRACTICE,
                    "Family medicine for all ages — minor infections, vaccinations, and knowing when to refer onward.", 16),
            new DoctorSpec("dr.delrosario@heron.care", "Noel del Rosario, MD", Specialization.GENERAL_PRACTICE,
                    "Lifestyle medicine, men's health checks, and smoking-cessation support.", 6),
            // -- Internal Medicine (the symptom workhorse) -> 4 total
            new DoctorSpec("dr.bernardo@heron.care", "Diana Bernardo, MD", Specialization.INTERNAL_MEDICINE,
                    "Hypertension, type 2 diabetes, and metabolic syndrome, with a focus on long-term follow-up.", 12),
            new DoctorSpec("dr.pascual@heron.care", "Eduardo Pascual, MD", Specialization.INTERNAL_MEDICINE,
                    "Respiratory infections, persistent fatigue work-ups, and recovery after acute illness.", 8),
            new DoctorSpec("dr.ramos@heron.care", "Beatriz Ramos, MD", Specialization.INTERNAL_MEDICINE,
                    "Complex chronic disease and medication review for older adults.", 22),
            // -- Endocrinology -> 3 total
            new DoctorSpec("dr.torres@heron.care", "Isabel Torres, MD", Specialization.ENDOCRINOLOGY,
                    "Diabetes and insulin management, PCOS, and bone-health concerns.", 10),
            new DoctorSpec("dr.mercado@heron.care", "Gabriel Mercado, MD", Specialization.ENDOCRINOLOGY,
                    "Thyroid disorders alongside adrenal and pituitary conditions.", 14),
            // -- Neurology -> 3 total
            new DoctorSpec("dr.dimaano@heron.care", "Hannah Dimaano, MD", Specialization.NEUROLOGY,
                    "Migraine and headache programmes, dizziness, and post-concussion follow-up.", 9),
            new DoctorSpec("dr.soriano@heron.care", "Victor Soriano, MD", Specialization.NEUROLOGY,
                    "Epilepsy, neuropathy, and movement-disorder management.", 19),
            // -- Dermatology -> 3 total
            new DoctorSpec("dr.valdez@heron.care", "Olivia Valdez, MD", Specialization.DERMATOLOGY,
                    "Acne, rosacea, and pigmentation, with photo-based review between visits.", 7),
            new DoctorSpec("dr.manalo@heron.care", "Paolo Manalo, MD", Specialization.DERMATOLOGY,
                    "Eczema, psoriasis, and routine skin-cancer surveillance.", 15),
            // -- Pediatrics -> 2 total
            new DoctorSpec("dr.carpio@heron.care", "Sandra Carpio, MD", Specialization.PEDIATRICS,
                    "Newborn and toddler care — fevers, feeding, and the childhood immunization schedule.", 11),
            // -- OB-GYN -> 2 total
            new DoctorSpec("dr.tolentino@heron.care", "Lourdes Tolentino, MD", Specialization.OB_GYN,
                    "Prenatal care, contraception counselling, and menstrual-health concerns.", 13),
            // -- Orthopedics (lowest telehealth fit — kept lean) -> 2 total
            new DoctorSpec("dr.padilla@heron.care", "Manuel Padilla, MD", Specialization.ORTHOPEDICS,
                    "Sports injuries, back and joint pain triage, and guidance through post-operative rehab.", 8));

    // 11 demo patients, now with the structured care profile (conditions /
    // allergies / medications / notes) the editor manages as tags. A couple are
    // deliberately sparse (jose, mark — null lists) so the doctor's patient-context
    // view also exercises the "Not provided" handling. An empty list means
    // "actively none" (e.g. no known allergies); null means "not filled in".
    private static final List<PatientSpec> PATIENTS = List.of(
            new PatientSpec("patient.demo@heron.care", "Demo Patient",
                    LocalDate.of(1991, 3, 12), Sex.MALE, 68.0, 172.0, "+63 917 555 1234",
                    List.of("Hypertension (diagnosed 2022)", "Mild seasonal asthma"),
                    List.of(),
                    List.of("Losartan 50 mg once daily", "Salbutamol inhaler as needed"),
                    "Non-smoker. Family history: father had a myocardial infarction at 58."),
            new PatientSpec("juan.cruz@heron.care", "Juan dela Cruz",
                    LocalDate.of(1985, 7, 22), Sex.MALE, 82.0, 178.0, "+63 918 222 3344",
                    List.of("Type 2 diabetes (since 2019)", "Occasional knee pain"),
                    List.of(),
                    List.of("Metformin"),
                    null),
            new PatientSpec("maria.santos@heron.care", "Maria Santos",
                    LocalDate.of(1993, 11, 2), Sex.FEMALE, 58.0, 161.0, "+63 919 444 5566",
                    List.of("Generalised anxiety", "Lactose intolerant"),
                    List.of(),
                    List.of(),
                    "Started CBT last year."),
            new PatientSpec("jose.protacio@heron.care", "Jose Protacio",
                    LocalDate.of(1978, 6, 19), Sex.MALE, null, null, "+63 917 888 1122",
                    null, null, null, null),
            new PatientSpec("ana.reyes@heron.care", "Ana Reyes",
                    LocalDate.of(1990, 1, 30), Sex.FEMALE, 64.0, 165.0, "+63 920 333 7788",
                    List.of("Mild persistent asthma"),
                    List.of("Penicillin (rash)"),
                    List.of(),
                    null),
            new PatientSpec("pedro.bautista@heron.care", "Pedro Bautista",
                    LocalDate.of(1965, 9, 14), Sex.MALE, 90.0, 175.0, "+63 921 555 9900",
                    List.of("Coronary artery disease (stent placed 2021)"),
                    List.of(),
                    List.of("Aspirin", "Atorvastatin"),
                    "Ex-smoker."),
            new PatientSpec("liza.garcia@heron.care", "Liza Garcia",
                    LocalDate.of(1998, 4, 5), Sex.FEMALE, 55.0, 158.0, null,
                    List.of("Eczema (since childhood)"),
                    List.of(),
                    List.of(),
                    "No other concerns."),
            new PatientSpec("mark.villanueva@heron.care", "Mark Villanueva",
                    LocalDate.of(2000, 12, 11), Sex.MALE, null, null, null,
                    null, null, null, null),
            new PatientSpec("grace.tan@heron.care", "Grace Tan",
                    LocalDate.of(1988, 8, 8), Sex.FEMALE, 60.0, 163.0, "+63 922 111 2233",
                    List.of(),
                    List.of(),
                    List.of(),
                    "Postpartum, three months. Breastfeeding. No chronic conditions."),
            new PatientSpec("ramon.aquino@heron.care", "Ramon Aquino",
                    LocalDate.of(1982, 2, 17), Sex.MALE, 78.0, 170.0, "+63 917 666 4455",
                    List.of(),
                    List.of(),
                    List.of(),
                    "Booking on behalf of his son (age 5). No personal history of note."),
            new PatientSpec("sofia.delosreyes@heron.care", "Sofia delos Reyes",
                    LocalDate.of(1995, 10, 25), Sex.FEMALE, 62.0, 167.0, "+63 918 999 0011",
                    List.of("Hypothyroidism"),
                    List.of(),
                    List.of("Levothyroxine"),
                    "Family history of skin cancer."));

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
                    BookingStatus.CONFIRMED, "Medication review for depression."),
            // Bookings on the newly deepened high-traffic doctors so their dashboards
            // are alive, not empty, when the demo dataset is seeded fresh.
            new BookingSpec("juan.cruz@heron.care", "dr.bernardo@heron.care", 2, 10, 0,
                    BookingStatus.CONFIRMED, "Blood pressure has been creeping up; want to review my medication."),
            new BookingSpec("patient.demo@heron.care", "dr.bernardo@heron.care", -6, 14, 0,
                    BookingStatus.CONFIRMED, "Routine diabetes check and recent lab review."),
            new BookingSpec("maria.santos@heron.care", "dr.domingo@heron.care", 3, 11, 0,
                    BookingStatus.CONFIRMED, "Anxiety has been worse lately; would like to talk through options."),
            new BookingSpec("ana.reyes@heron.care", "dr.domingo@heron.care", -4, 15, 30,
                    BookingStatus.CONFIRMED, "Follow-up on mood and sleep."),
            new BookingSpec("jose.protacio@heron.care", "dr.aguilar@heron.care", 1, 9, 30,
                    BookingStatus.CONFIRMED, "General check-up — feeling run down for a couple of weeks."),
            new BookingSpec("sofia.delosreyes@heron.care", "dr.torres@heron.care", 4, 13, 30,
                    BookingStatus.CONFIRMED, "Thyroid medication review."),
            new BookingSpec("grace.tan@heron.care", "dr.dimaano@heron.care", 2, 16, 0,
                    BookingStatus.CONFIRMED, "Recurring migraines, want a management plan."),
            new BookingSpec("liza.garcia@heron.care", "dr.valdez@heron.care", -3, 10, 30,
                    BookingStatus.CONFIRMED, "Persistent acne flare, would like to review treatment."));

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final BookingRepository bookingRepository;
    private final ProfilePictureRepository profilePictureRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Override
    public void run(String... args) {
        boolean reset = "true".equalsIgnoreCase(System.getenv("SEED_RESET"));

        if (reset) {
            resetDemoData();
        }
        ensureDoctors();
        backfillMeetingLinks();
        backfillLicenses();
        backfillPublishedFlag();
        ensurePatients();
        seedBookings(reset);
        ensureDemoConsultation();
    }

    // SEED_RESET=true: wipe the identity + profile layer so a reseed comes back
    // clean (bookings are handled in seedBookings, which also keys off reset).
    // Deliberate, never on by default — the destructive demo refresh. Profile
    // pictures and notifications are wiped too because they reference userIds
    // that the recreated accounts will not keep.
    private void resetDemoData() {
        long users = userRepository.count();
        notificationRepository.deleteAll();
        profilePictureRepository.deleteAll();
        doctorProfileRepository.deleteAll();
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
        log.warn("[seed] SEED_RESET — wiped users/profiles/pictures/notifications (was {} users)", users);
    }

    // Sets the public-listing `published` flag on every doctor from the
    // completeness rule. Doctors created before this flag existed get listed if
    // complete; incomplete or test profiles (no bio/meeting link/availability)
    // drop out of discovery and recommendations. Runs after the meeting-link
    // backfill so a just-backfilled link counts toward completeness. Idempotent —
    // only writes when the computed flag differs from what's stored.
    private void backfillPublishedFlag() {
        int updated = 0;
        for (DoctorProfile profile : doctorProfileRepository.findAll()) {
            boolean shouldPublish = ProfileCompleteness.isDoctorPublishable(profile);
            if (profile.isPublished() != shouldPublish) {
                profile.setPublished(shouldPublish);
                doctorProfileRepository.save(profile);
                updated++;
            }
        }
        if (updated > 0) {
            log.info("[seed] set published flag on {} doctor(s)", updated);
        }
    }

    // Ensures one COMPLETED consult with finalized SOAP notes + a prescription, so
    // the patient's "consultation summary" and the doctor's notes view are populated
    // on sight. The normal flow only reaches COMPLETED after a consult has elapsed
    // and the doctor finalizes, so a grader can't otherwise see these in a session.
    // Idempotent via a stable idempotency key — additive, never wipes/duplicates
    // live bookings (so it appears on the shared DB on the next restart, no reset).
    private void ensureDemoConsultation() {
        final String idempotencyKey = "seed-demo-consult-001";
        final String doctorEmail = "dr.cruz@heron.care";
        String patientUserId = userRepository.findByEmail("patient.demo@heron.care")
                .map(User::getId).orElse(null);
        String doctorUserId = userRepository.findByEmail(doctorEmail)
                .map(User::getId).orElse(null);
        if (patientUserId == null || doctorUserId == null) {
            return;
        }
        if (bookingRepository.findByPatientUserIdAndIdempotencyKey(patientUserId, idempotencyKey)
                .isPresent()) {
            return; // already seeded
        }
        Instant startsAt = instantAt(-14, 11, 0);
        Instant endsAt = startsAt.plus(SLOT_MINUTES, ChronoUnit.MINUTES);
        ConsultationRecord record = ConsultationRecord.builder()
                .subjective("Reports several weeks of afternoon fatigue and occasional light-headedness on standing; sleep has been poor.")
                .objective("Alert and oriented. Blood pressure 118/76, heart rate 74 and regular. No pallor; cardiovascular and respiratory exam unremarkable on video.")
                .assessment("Fatigue likely multifactorial — poor sleep with possible iron deficiency. Light-headedness appears postural. No red-flag features.")
                .plan("Advised sleep hygiene and hydration. Requested CBC and ferritin. Review in two weeks with results; return sooner if symptoms worsen.")
                .prescription(List.of(
                        ConsultationRecord.PrescriptionItem.builder()
                                .medication("Ferrous sulfate")
                                .dosage("325 mg once daily")
                                .instructions("Take with food. Recheck iron levels in six weeks.")
                                .build(),
                        ConsultationRecord.PrescriptionItem.builder()
                                .medication("Vitamin D3")
                                .dosage("1000 IU once daily")
                                .instructions("Continue through the rainy season.")
                                .build()))
                .finalizedAt(endsAt)
                .build();
        bookingRepository.save(Booking.builder()
                .patientUserId(patientUserId)
                .doctorUserId(doctorUserId)
                .startsAt(startsAt)
                .endsAt(endsAt)
                .status(BookingStatus.COMPLETED)
                .concernNote("Persistent afternoon fatigue and occasional dizziness.")
                .meetingLink(DOCTOR_MEETING_LINKS.get(doctorEmail))
                .consultationRecord(record)
                .idempotencyKey(idempotencyKey)
                .build());
        log.info("[seed] ensured demo completed consultation");
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
                    .prcLicenseNo(generatedLicense(spec.email(), "prc"))
                    .ptrNo(generatedLicense(spec.email(), "ptr"))
                    .availability(Availability.defaultBusinessHours())
                    .published(true) // seeded doctors are complete → publicly listed
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
                    .sex(spec.sex())
                    .weightKg(spec.weightKg())
                    .heightCm(spec.heightCm())
                    .contactNumber(spec.contactNumber())
                    .conditions(spec.conditions())
                    .allergies(spec.allergies())
                    .medications(spec.medications())
                    .notesForDoctor(spec.notesForDoctor())
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

    // Backfills generated PRC/PTR license numbers onto doctors that pre-date the
    // license fields. Idempotent: only writes when a value is missing. The numbers
    // are deterministic per email so a backfill matches what ensureDoctors assigns.
    private void backfillLicenses() {
        int updated = 0;
        for (DoctorProfile profile : doctorProfileRepository.findAll()) {
            String email = userRepository.findById(profile.getUserId())
                    .map(User::getEmail).orElse(null);
            if (email == null) {
                continue;
            }
            boolean changed = false;
            if (profile.getPrcLicenseNo() == null || profile.getPrcLicenseNo().isBlank()) {
                profile.setPrcLicenseNo(generatedLicense(email, "prc"));
                changed = true;
            }
            if (profile.getPtrNo() == null || profile.getPtrNo().isBlank()) {
                profile.setPtrNo(generatedLicense(email, "ptr"));
                changed = true;
            }
            if (changed) {
                doctorProfileRepository.save(profile);
                updated++;
            }
        }
        if (updated > 0) {
            log.info("[seed] backfilled license numbers on {} doctor(s)", updated);
        }
    }

    // A stable 7-digit license number derived from the doctor's email + kind, so
    // the same doctor always gets the same PRC/PTR across restarts. MVP flavor
    // only — not a verified credential (PRC verification is Future Work).
    private static String generatedLicense(String email, String kind) {
        int h = Math.abs((email + "-" + kind).hashCode());
        return String.format("%07d", h % 10_000_000);
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
            String email, String name, LocalDate birthday, Sex sex, Double weightKg,
            Double heightCm, String contactNumber, List<String> conditions,
            List<String> allergies, List<String> medications, String notesForDoctor) {}

    private record BookingSpec(
            String patientEmail, String doctorEmail, int daysFromNow, int hour,
            int minute, BookingStatus status, String concernNote) {}
}
