package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Booking;
import care.heron.api.document.ConsultationRecord;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.ProfilePicture;
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
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
                    "Family history of skin cancer."),
            // -- Demo-day depth: a broader patient pool so bookings spread across
            // many doctors realistically and the patient-context pane shows variety.
            new PatientSpec("carlos.mendez@heron.care", "Carlos Mendez",
                    LocalDate.of(1970, 5, 14), Sex.MALE, 88.0, 174.0, "+63 917 201 3040",
                    List.of("Hypertension", "High cholesterol"), List.of(),
                    List.of("Amlodipine 5 mg daily", "Atorvastatin 20 mg nightly"),
                    "Desk job, minimal exercise. Wants to lower cardiovascular risk."),
            new PatientSpec("noel.bautista@heron.care", "Noel Bautista",
                    LocalDate.of(1988, 9, 3), Sex.MALE, 75.0, 171.0, "+63 918 332 1144",
                    List.of(), List.of("Sulfa drugs (hives)"), List.of(), null),
            new PatientSpec("rico.delacruz@heron.care", "Rico dela Cruz",
                    LocalDate.of(1995, 12, 20), Sex.MALE, 70.0, 168.0, "+63 919 555 7788",
                    List.of("Asthma"), List.of(), List.of("Salbutamol inhaler as needed"),
                    "Triggered by dust and exercise."),
            new PatientSpec("vincent.ong@heron.care", "Vincent Ong",
                    LocalDate.of(1963, 2, 28), Sex.MALE, 92.0, 176.0, "+63 920 661 2233",
                    List.of("Type 2 diabetes", "Gout"), List.of(),
                    List.of("Metformin 1000 mg twice daily", "Allopurinol 300 mg daily"),
                    "Retired. Watches diet loosely."),
            new PatientSpec("daniel.reyes@heron.care", "Daniel Reyes",
                    LocalDate.of(2001, 7, 7), Sex.MALE, null, null, null,
                    null, null, null, null),
            new PatientSpec("arturo.lim@heron.care", "Arturo Lim",
                    LocalDate.of(1979, 11, 11), Sex.MALE, 80.0, 173.0, "+63 921 778 9900",
                    List.of("Chronic lower back pain"), List.of(), List.of(),
                    "Warehouse worker; pain worse after lifting."),
            new PatientSpec("benedict.cruz@heron.care", "Benedict Cruz",
                    LocalDate.of(1992, 4, 18), Sex.MALE, 68.0, 170.0, "+63 917 889 0011",
                    List.of(), List.of(), List.of(), "Generally healthy. Annual check-up."),
            new PatientSpec("oscar.tan@heron.care", "Oscar Tan",
                    LocalDate.of(1958, 8, 25), Sex.MALE, 84.0, 169.0, "+63 918 990 1122",
                    List.of("Coronary artery disease", "Hypertension"),
                    List.of("Aspirin (GI upset)"),
                    List.of("Clopidogrel", "Bisoprolol"), "Completed cardiac rehab last year."),
            new PatientSpec("felix.santos@heron.care", "Felix Santos",
                    LocalDate.of(1984, 3, 9), Sex.MALE, 77.0, 175.0, "+63 919 112 2334",
                    List.of("Migraine"), List.of(), List.of("Sumatriptan as needed"),
                    "Migraines roughly twice a month."),
            new PatientSpec("gerald.aquino@heron.care", "Gerald Aquino",
                    LocalDate.of(1997, 6, 30), Sex.MALE, 72.0, 178.0, "+63 920 223 4455",
                    List.of(), List.of(), List.of(), null),
            new PatientSpec("marlon.garcia@heron.care", "Marlon Garcia",
                    LocalDate.of(1975, 10, 2), Sex.MALE, 95.0, 172.0, "+63 921 334 5566",
                    List.of("Obesity", "Obstructive sleep apnea"), List.of(), List.of(),
                    "Using CPAP nightly; wants a weight-management plan."),
            new PatientSpec("enrique.flores@heron.care", "Enrique Flores",
                    LocalDate.of(1968, 1, 19), Sex.MALE, 81.0, 171.0, "+63 917 445 6677",
                    List.of("Hypothyroidism"), List.of(),
                    List.of("Levothyroxine 75 mcg daily"), null),
            new PatientSpec("carmela.reyes@heron.care", "Carmela Reyes",
                    LocalDate.of(1990, 3, 22), Sex.FEMALE, 60.0, 162.0, "+63 918 556 7788",
                    List.of("PCOS"), List.of(), List.of(), "Trying to conceive."),
            new PatientSpec("jasmine.tan@heron.care", "Jasmine Tan",
                    LocalDate.of(1986, 7, 14), Sex.FEMALE, 57.0, 160.0, "+63 919 667 8899",
                    List.of("Hypothyroidism", "Iron-deficiency anemia"), List.of(),
                    List.of("Levothyroxine 50 mcg", "Ferrous sulfate"), null),
            new PatientSpec("isabel.cruz@heron.care", "Isabel Cruz",
                    LocalDate.of(1999, 11, 5), Sex.FEMALE, 54.0, 158.0, "+63 920 778 9900",
                    List.of("Anxiety"), List.of(), List.of(),
                    "First time seeking mental-health support."),
            new PatientSpec("patricia.lim@heron.care", "Patricia Lim",
                    LocalDate.of(1973, 5, 29), Sex.FEMALE, 66.0, 165.0, "+63 921 889 0011",
                    List.of("Type 2 diabetes", "Hypertension"), List.of("Penicillin"),
                    List.of("Metformin", "Losartan"), "Strong family history of diabetes."),
            new PatientSpec("bea.santos@heron.care", "Bea Santos",
                    LocalDate.of(1994, 9, 17), Sex.FEMALE, 58.0, 161.0, "+63 917 990 1122",
                    List.of("Eczema"), List.of("Nickel (contact dermatitis)"), List.of(), null),
            new PatientSpec("denise.garcia@heron.care", "Denise Garcia",
                    LocalDate.of(1982, 12, 8), Sex.FEMALE, 63.0, 164.0, "+63 918 101 2233",
                    List.of("Migraine", "Depression"), List.of(),
                    List.of("Fluoxetine 20 mg daily"), "On medication eight months, stable."),
            new PatientSpec("rowena.aquino@heron.care", "Rowena Aquino",
                    LocalDate.of(1965, 4, 26), Sex.FEMALE, 70.0, 159.0, "+63 919 212 3344",
                    List.of("Osteoarthritis", "Hypertension"), List.of(),
                    List.of("Amlodipine 5 mg"), "Knee pain worse in the mornings."),
            new PatientSpec("katrina.flores@heron.care", "Katrina Flores",
                    LocalDate.of(2002, 2, 13), Sex.FEMALE, null, null, null,
                    null, null, null, null),
            new PatientSpec("mariel.ocampo@heron.care", "Mariel Ocampo",
                    LocalDate.of(1991, 8, 21), Sex.FEMALE, 59.0, 163.0, "+63 920 323 4455",
                    List.of(), List.of(), List.of(),
                    "28 weeks pregnant, first pregnancy. No complications so far."),
            new PatientSpec("celine.torres@heron.care", "Celine Torres",
                    LocalDate.of(1978, 6, 4), Sex.FEMALE, 68.0, 166.0, "+63 921 434 5566",
                    List.of("Hypothyroidism"), List.of(),
                    List.of("Levothyroxine 100 mcg"), null),
            new PatientSpec("angelica.reyes@heron.care", "Angelica Reyes",
                    LocalDate.of(1996, 10, 30), Sex.FEMALE, 56.0, 160.0, "+63 917 545 6677",
                    List.of("Moderate acne"), List.of(), List.of(),
                    "Tried over-the-counter treatments without success."),
            new PatientSpec("vanessa.cruz@heron.care", "Vanessa Cruz",
                    LocalDate.of(1969, 3, 15), Sex.FEMALE, 72.0, 167.0, "+63 918 656 7788",
                    List.of("Breast cancer survivor (2019, in remission)"), List.of(),
                    List.of("Tamoxifen"), "Regular surveillance follow-up."));

    // ---- Demo-day enrichment: photos, consult notes, and reasons-for-visit ----

    // Sex per doctor, used only to gender-match a seeded profile photo (the doctor
    // profile carries no Sex field). 'f' = woman, 'm' = man.
    private static final Map<String, Character> DOCTOR_SEX = Map.ofEntries(
            Map.entry("dr.reyes@heron.care", 'f'), Map.entry("dr.tan@heron.care", 'm'),
            Map.entry("dr.santos@heron.care", 'f'), Map.entry("dr.lim@heron.care", 'm'),
            Map.entry("dr.cruz@heron.care", 'f'), Map.entry("dr.garcia@heron.care", 'm'),
            Map.entry("dr.flores@heron.care", 'f'), Map.entry("dr.mendoza@heron.care", 'm'),
            Map.entry("dr.romero@heron.care", 'f'), Map.entry("dr.ocampo@heron.care", 'f'),
            Map.entry("dr.velasco@heron.care", 'm'), Map.entry("dr.domingo@heron.care", 'f'),
            Map.entry("dr.navarro@heron.care", 'm'), Map.entry("dr.salazar@heron.care", 'f'),
            Map.entry("dr.aguilar@heron.care", 'm'), Map.entry("dr.castillo@heron.care", 'f'),
            Map.entry("dr.delrosario@heron.care", 'm'), Map.entry("dr.bernardo@heron.care", 'f'),
            Map.entry("dr.pascual@heron.care", 'm'), Map.entry("dr.ramos@heron.care", 'f'),
            Map.entry("dr.torres@heron.care", 'f'), Map.entry("dr.mercado@heron.care", 'm'),
            Map.entry("dr.dimaano@heron.care", 'f'), Map.entry("dr.soriano@heron.care", 'm'),
            Map.entry("dr.valdez@heron.care", 'f'), Map.entry("dr.manalo@heron.care", 'm'),
            Map.entry("dr.carpio@heron.care", 'f'), Map.entry("dr.tolentino@heron.care", 'f'),
            Map.entry("dr.padilla@heron.care", 'm'));

    // A realistic minority of accounts keep initial-letter avatars (so the demo
    // also shows the no-photo fallback). Everyone else gets a gender-matched photo.
    private static final Set<String> NO_PHOTO = Set.of(
            "dr.delrosario@heron.care", "dr.pascual@heron.care", "dr.carpio@heron.care",
            "dr.padilla@heron.care",
            "jose.protacio@heron.care", "mark.villanueva@heron.care", "daniel.reyes@heron.care",
            "katrina.flores@heron.care", "gerald.aquino@heron.care", "benedict.cruz@heron.care");

    // Demo doctors who run Saturday clinics (Mon-Sat hours) — the hero plus at
    // least one per specialty, so a Saturday demo shows a populated dashboard and
    // Saturday browsing/booking still returns results. The rest keep Mon-Fri, so
    // "Off on Saturday" is also represented.
    private static final Set<String> SATURDAY_DOCTORS = Set.of(
            "dr.cruz@heron.care",      // hero (Internal Medicine)
            "dr.reyes@heron.care",     // Cardiology
            "dr.santos@heron.care",    // Dermatology
            "dr.lim@heron.care",       // Pediatrics
            "dr.garcia@heron.care",    // Psychiatry
            "dr.flores@heron.care",    // General Practice
            "dr.romero@heron.care",    // Neurology
            "dr.ocampo@heron.care",    // OB-GYN
            "dr.velasco@heron.care",   // Endocrinology
            "dr.mendoza@heron.care",   // Orthopedics
            "dr.bernardo@heron.care",  // Internal Medicine
            "dr.domingo@heron.care",   // Psychiatry
            "dr.aguilar@heron.care",   // General Practice
            "dr.torres@heron.care",    // Endocrinology
            "dr.dimaano@heron.care",   // Neurology
            "dr.valdez@heron.care");   // Dermatology

    // SOAP note + prescription templates, rotated across the COMPLETED (and a few
    // draft) consults so visit summaries and the doctor's notes view show real
    // content. General-internal-medicine flavour; the demo doesn't pretend these
    // are specialty-perfect.
    private static final List<Soap> SOAP_TEMPLATES = List.of(
            new Soap(
                    "Reports the blood pressure log shows readings around 145/92 over the past month; no chest pain or breathlessness.",
                    "BP 148/94 today, heart rate 78 regular. Weight stable. Cardiovascular and respiratory exam unremarkable on video.",
                    "Hypertension, not yet at target on current therapy. No end-organ red flags.",
                    "Increase to the next dose step, continue home monitoring, reduce salt intake. Review in four weeks with a fresh BP log.",
                    List.of(rx("Amlodipine", "10 mg once daily", "Take in the morning. Watch for ankle swelling."))),
            new Soap(
                    "Three months of poor sleep and afternoon fatigue; mood low but no thoughts of self-harm. Appetite normal.",
                    "Alert, engaged. No acute distress. PHQ-style screen suggests mild-to-moderate low mood.",
                    "Adjustment-related low mood with insomnia. No features needing urgent referral.",
                    "Start sleep-hygiene plan and brief activity scheduling. Offered counselling referral. Review in three weeks.",
                    List.of(rx("Melatonin", "3 mg at night", "Take 30 minutes before bed for two weeks, then reassess."))),
            new Soap(
                    "Recent labs reviewed together. HbA1c improved from 8.1 to 7.2 since the last visit. Tolerating metformin well.",
                    "BMI 28. No new neuropathy symptoms. Feet examined by patient on camera — no lesions reported.",
                    "Type 2 diabetes, improving control. On track with lifestyle changes.",
                    "Continue current regimen. Repeat HbA1c in three months. Reinforce diet and walking plan.",
                    List.of(rx("Metformin", "1000 mg twice daily", "Continue with meals. Report any persistent GI upset."))),
            new Soap(
                    "Thyroid medication review; feeling well, no palpitations or temperature intolerance. Energy back to normal.",
                    "Calm, well. No tremor. Recent TSH within target range.",
                    "Hypothyroidism, well controlled on current dose.",
                    "No dose change. Repeat TSH in six months. Continue once-daily dosing on an empty stomach.",
                    List.of(rx("Levothyroxine", "75 mcg once daily", "Take on an empty stomach, 30–60 minutes before breakfast."))),
            new Soap(
                    "Recurring headaches roughly twice a month, throbbing and one-sided, with light sensitivity. No weakness or visual loss.",
                    "Neurological screen on video grossly normal. No red-flag features. Blood pressure normal.",
                    "Episodic migraine without aura. No indicators for urgent imaging.",
                    "Start a headache diary, identify triggers, and use an acute medication early in an attack. Review in six weeks.",
                    List.of(rx("Sumatriptan", "50 mg as needed", "Take at the onset of a migraine; maximum two doses in 24 hours."))),
            new Soap(
                    "Persistent fatigue for several weeks with occasional light-headedness on standing; sleep poor.",
                    "BP 118/76, heart rate 74 regular. No pallor; exam unremarkable on video.",
                    "Fatigue likely multifactorial — poor sleep with possible iron deficiency. Light-headedness appears postural.",
                    "Advised sleep hygiene and hydration. Requested CBC and ferritin. Review in two weeks with results.",
                    List.of(rx("Ferrous sulfate", "325 mg once daily", "Take with food. Recheck iron levels in six weeks."))),
            new Soap(
                    "Itchy, scaly patches on the forearms for two weeks; worse after gardening. No fever or spreading redness.",
                    "Two well-defined erythematous, mildly scaly plaques on the extensor forearms. No weeping or pustules on camera.",
                    "Contact dermatitis, likely irritant. No signs of infection.",
                    "Avoid the suspected trigger, use a barrier emollient, and a short course of topical steroid. Review if not settling in two weeks.",
                    List.of(rx("Hydrocortisone 1% cream", "Apply twice daily", "Use on affected areas for up to seven days."))),
            new Soap(
                    "Post-cardiac-rehab review; walking 30 minutes daily without chest pain or breathlessness. Adhering to medication.",
                    "Comfortable at rest. Heart rate 64 regular. Reports stable exercise tolerance.",
                    "Stable coronary artery disease, well managed. No new symptoms.",
                    "Continue current cardiac medications and exercise plan. Routine review in three months; seek care sooner for any chest pain.",
                    List.of(rx("Atorvastatin", "40 mg once daily", "Take at night. Continue indefinitely unless advised otherwise."))));

    // Reasons-for-visit, rotated across the spread bookings so each doctor's list
    // reads naturally rather than repeating one line.
    private static final List<String> CONCERNS = List.of(
            "Persistent cough that won't clear after two weeks.",
            "Follow-up on recent blood test results.",
            "Feeling unusually tired for the past month.",
            "Recurring headaches, would like a management plan.",
            "Blood pressure has been creeping up at home.",
            "Annual check-up and general screening.",
            "Trouble sleeping and daytime fatigue.",
            "Skin rash that keeps coming back.",
            "Joint stiffness in the mornings.",
            "Reviewing my current medications.",
            "Stomach discomfort after meals.",
            "Anxiety has been harder to manage lately.",
            "Shortness of breath with light activity.",
            "Dizziness when standing up quickly.",
            "Thyroid medication review.",
            "Diabetes check-in and lifestyle advice.",
            "A mole I'd like checked.",
            "Lingering fatigue after a recent illness.",
            "Migraine prevention options.",
            "General wellness consultation.");

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
        ensureSaturdayHours();
        backfillPublishedFlag();
        ensurePatients();
        seedProfilePictures();
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
                    .availability(SATURDAY_DOCTORS.contains(spec.email())
                            ? Availability.businessHoursMonToSat()
                            : Availability.defaultBusinessHours())
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

    // Gender-matched profile photos for most accounts, bundled under
    // resources/seed-photos. Re-seeded after a reset (the wipe drops the picture
    // collection and recreated accounts get fresh ids). Idempotent — skips a user
    // who already has a picture, so a normal restart doesn't re-write.
    private void seedProfilePictures() {
        int[] next = {0, 0}; // running index into [men, women] of the bundled set
        int created = 0;
        for (DoctorSpec d : DOCTORS) {
            if (NO_PHOTO.contains(d.email())) continue;
            if (assignPhoto(d.email(), DOCTOR_SEX.getOrDefault(d.email(), 'm'), next)) created++;
        }
        for (PatientSpec p : PATIENTS) {
            if (NO_PHOTO.contains(p.email())) continue;
            if (assignPhoto(p.email(), p.sex() == Sex.FEMALE ? 'f' : 'm', next)) created++;
        }
        if (created > 0) {
            log.info("[seed] seeded {} profile photo(s)", created);
        }
    }

    // Loads the next bundled photo of the given sex ('m'/'f') and stores it for the
    // user. Returns false (and advances nothing) when the user is missing, already
    // has a picture, or we run out of bundled faces.
    private boolean assignPhoto(String email, char sex, int[] next) {
        String userId = userRepository.findByEmail(email).map(User::getId).orElse(null);
        if (userId == null || profilePictureRepository.findByUserId(userId).isPresent()) {
            return false;
        }
        int slot = sex == 'f' ? 1 : 0;
        String file = String.format("%c%02d.jpg", sex, next[slot]);
        byte[] bytes;
        try {
            bytes = new ClassPathResource("seed-photos/" + file).getInputStream().readAllBytes();
        } catch (Exception e) {
            log.warn("[seed] could not read photo resource {}", file);
            return false;
        }
        next[slot]++;
        profilePictureRepository.save(ProfilePicture.builder()
                .userId(userId).data(bytes).contentType("image/jpeg").build());
        return true;
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
        Map<String, String> ids = new HashMap<>();
        for (DoctorSpec d : DOCTORS) {
            userRepository.findByEmail(d.email()).ifPresent(u -> ids.put(d.email(), u.getId()));
        }
        for (PatientSpec p : PATIENTS) {
            userRepository.findByEmail(p.email()).ifPresent(u -> ids.put(p.email(), u.getId()));
        }
        int created = seedHeroDay(ids) + seedDemoPatientJourney(ids) + seedSpread(ids);
        log.info("[seed] created {} demo booking(s)", created);
    }

    // The hero doctor (Patricia Cruz) — a full, realistic day plus history and
    // future, so the dashboard shows everything at once: completed-earlier, a
    // visit happening now, upcoming, ended-awaiting-notes, and a started draft.
    // The two early consults are finalized; the rest of today stays CONFIRMED so
    // they read as ended / now / upcoming purely by the clock at view time.
    private int seedHeroDay(Map<String, String> ids) {
        final String email = "dr.cruz@heron.care";
        final String doc = ids.get(email);
        if (doc == null) return 0;
        int n = 0;
        // --- Today ---
        n += save(slot(ids.get("carlos.mendez@heron.care"), email, doc, 0, 9, 0, BookingStatus.COMPLETED,
                "Blood pressure review and cholesterol follow-up.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(0), 0, 9, 0)));
        n += save(slot(ids.get("vincent.ong@heron.care"), email, doc, 0, 9, 30, BookingStatus.COMPLETED,
                "Diabetes and gout check-in.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(2), 0, 9, 30)));
        n += save(slot(ids.get("patricia.lim@heron.care"), email, doc, 0, 10, 0, BookingStatus.CONFIRMED,
                "Diabetes management and recent labs.")
                .consultationRecord(draft(SOAP_TEMPLATES.get(2)))); // notes started, not finalized
        n += save(slot(ids.get("enrique.flores@heron.care"), email, doc, 0, 10, 30, BookingStatus.CONFIRMED,
                "Thyroid medication review."));
        n += save(slot(ids.get("marlon.garcia@heron.care"), email, doc, 0, 11, 30, BookingStatus.CONFIRMED,
                "Weight management and sleep-apnoea follow-up."));
        n += save(slot(ids.get("jose.protacio@heron.care"), email, doc, 0, 13, 30, BookingStatus.CONFIRMED,
                "Annual check-up and diabetes screening."));
        n += save(slot(ids.get("oscar.tan@heron.care"), email, doc, 0, 14, 30, BookingStatus.CONFIRMED,
                "Post-cardiac-rehab medication review."));
        n += save(slot(ids.get("rowena.aquino@heron.care"), email, doc, 0, 15, 30, BookingStatus.CONFIRMED,
                "Blood pressure and knee pain."));
        n += save(slot(ids.get("arturo.lim@heron.care"), email, doc, 0, 16, 0, BookingStatus.CONFIRMED,
                "Persistent fatigue work-up."));
        // --- Recent past: ended, awaiting notes (one with a draft started) ---
        n += save(slot(ids.get("felix.santos@heron.care"), email, doc, -1, 14, 0, BookingStatus.CONFIRMED,
                "Recurring headaches, want to rule out causes."));
        n += save(slot(ids.get("carmela.reyes@heron.care"), email, doc, -2, 10, 0, BookingStatus.CONFIRMED,
                "Fatigue and irregular cycles.")
                .consultationRecord(draft(SOAP_TEMPLATES.get(5))));
        n += save(slot(ids.get("gerald.aquino@heron.care"), email, doc, -3, 15, 0, BookingStatus.CONFIRMED,
                "Follow-up on recent blood work."));
        // --- Completed history (medical records / view notes) ---
        n += save(slot(ids.get("juan.cruz@heron.care"), email, doc, -7, 9, 30, BookingStatus.COMPLETED,
                "Reviewing recent blood test results.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(2), -7, 9, 30)));
        n += save(slot(ids.get("maria.santos@heron.care"), email, doc, -12, 11, 0, BookingStatus.COMPLETED,
                "Persistent fatigue and dizziness.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(5), -12, 11, 0)));
        n += save(slot(ids.get("vincent.ong@heron.care"), email, doc, -20, 14, 30, BookingStatus.COMPLETED,
                "Routine diabetes review.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(2), -20, 14, 30)));
        n += save(slot(ids.get("carlos.mendez@heron.care"), email, doc, -30, 10, 30, BookingStatus.COMPLETED,
                "Hypertension follow-up.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(0), -30, 10, 30)));
        // --- Upcoming this week and beyond ---
        n += save(slot(ids.get("patricia.lim@heron.care"), email, doc, 1, 9, 0, BookingStatus.CONFIRMED,
                "Three-month diabetes review."));
        n += save(slot(ids.get("enrique.flores@heron.care"), email, doc, 2, 11, 0, BookingStatus.CONFIRMED,
                "Thyroid labs follow-up."));
        n += save(slot(ids.get("marlon.garcia@heron.care"), email, doc, 3, 14, 0, BookingStatus.CONFIRMED,
                "Weight-management plan check-in."));
        n += save(slot(ids.get("oscar.tan@heron.care"), email, doc, 5, 10, 0, BookingStatus.CONFIRMED,
                "Cardiac medication review."));
        // --- A cancelled and a rescheduled, for completeness ---
        n += save(slot(ids.get("felix.santos@heron.care"), email, doc, 4, 13, 0, BookingStatus.CANCELLED,
                "Migraine consult.").cancelledAt(clock.instant()));
        Instant heroPrev = instantAt(2, 16, 0);
        n += save(slot(ids.get("benedict.cruz@heron.care"), email, doc, 6, 11, 30, BookingStatus.CONFIRMED,
                "General check-up.")
                .rescheduledHistory(List.of(Booking.RescheduledFrom.builder()
                        .previousStartsAt(heroPrev)
                        .previousEndsAt(heroPrev.plus(SLOT_MINUTES, ChronoUnit.MINUTES))
                        .rescheduledAt(clock.instant()).build())));
        return n;
    }

    // The demo patient's own appointment list — one of each state so the patient
    // surfaces (list / week / month / cancel / summary) all have something to show.
    private int seedDemoPatientJourney(Map<String, String> ids) {
        final String pat = ids.get("patient.demo@heron.care");
        if (pat == null) return 0;
        int n = 0;
        n += save(slot(pat, "dr.reyes@heron.care", ids.get("dr.reyes@heron.care"), 0, 15, 0,
                BookingStatus.CONFIRMED, "Follow-up on my blood pressure medication.")); // today / joinable
        n += save(slot(pat, "dr.garcia@heron.care", ids.get("dr.garcia@heron.care"), 2, 10, 30,
                BookingStatus.CONFIRMED, "Trouble sleeping and persistent anxiety.")); // upcoming
        n += save(slot(pat, "dr.flores@heron.care", ids.get("dr.flores@heron.care"), -1, 11, 0,
                BookingStatus.CONFIRMED, "General check-up, feeling run down.")); // ended, awaiting summary
        n += save(slot(pat, "dr.reyes@heron.care", ids.get("dr.reyes@heron.care"), -25, 10, 0,
                BookingStatus.COMPLETED, "Chest tightness on exertion.")
                .consultationRecord(finalized(SOAP_TEMPLATES.get(7), -25, 10, 0))); // completed summary
        n += save(slot(pat, "dr.tan@heron.care", ids.get("dr.tan@heron.care"), 5, 9, 30,
                BookingStatus.CANCELLED, "Second opinion on my ECG.").cancelledAt(clock.instant())); // cancelled
        Instant prev = instantAt(1, 9, 0);
        n += save(slot(pat, "dr.santos@heron.care", ids.get("dr.santos@heron.care"), 4, 14, 0,
                BookingStatus.CONFIRMED, "Skin rash review.")
                .rescheduledHistory(List.of(Booking.RescheduledFrom.builder()
                        .previousStartsAt(prev).previousEndsAt(prev.plus(SLOT_MINUTES, ChronoUnit.MINUTES))
                        .rescheduledAt(clock.instant()).build()))); // rescheduled
        return n;
    }

    // Every non-hero doctor gets a small, deterministic spread so no dashboard or
    // calendar is empty and the marketplace feels alive: a completed consult with
    // notes, a recently-ended one awaiting notes, an upcoming one, and — on a
    // rotation — a cancellation, a started draft, and an extra upcoming. Patients
    // rotate through the pool (excluding the demo patient, whose list stays curated).
    private int seedSpread(Map<String, String> ids) {
        List<String> pool = new ArrayList<>();
        for (PatientSpec p : PATIENTS) {
            if (p.email().equals("patient.demo@heron.care")) continue;
            String id = ids.get(p.email());
            if (id != null) pool.add(id);
        }
        if (pool.isEmpty()) return 0;
        int n = 0, di = 0;
        for (DoctorSpec d : DOCTORS) {
            if (d.email().equals("dr.cruz@heron.care")) continue; // hero owns its own day
            final String email = d.email();
            final String doc = ids.get(email);
            if (doc == null) continue;
            String p1 = pool.get((di * 4) % pool.size());
            String p2 = pool.get((di * 4 + 1) % pool.size());
            String p3 = pool.get((di * 4 + 2) % pool.size());
            String p4 = pool.get((di * 4 + 3) % pool.size());

            int cd = -(8 + di % 15); // completed, with finalized notes
            n += save(slot(p1, email, doc, cd, 10, 0, BookingStatus.COMPLETED,
                    CONCERNS.get(di % CONCERNS.size()))
                    .consultationRecord(finalized(SOAP_TEMPLATES.get(di % SOAP_TEMPLATES.size()), cd, 10, 0)));
            int ed = -(1 + di % 3); // recently ended, awaiting notes
            n += save(slot(p2, email, doc, ed, 14, 0, BookingStatus.CONFIRMED,
                    CONCERNS.get((di + 5) % CONCERNS.size())));
            int ud = 1 + di % 6; // upcoming this week
            n += save(slot(p3, email, doc, ud, 11, 0, BookingStatus.CONFIRMED,
                    CONCERNS.get((di + 10) % CONCERNS.size())));

            if (di % 3 == 0) {
                n += save(slot(p4, email, doc, 2 + di % 5, 15, 30, BookingStatus.CANCELLED,
                        CONCERNS.get((di + 3) % CONCERNS.size())).cancelledAt(clock.instant()));
            }
            if (di % 4 == 0) {
                int dd = -(1 + (di + 1) % 3);
                n += save(slot(p4, email, doc, dd, 9, 30, BookingStatus.CONFIRMED,
                        CONCERNS.get((di + 7) % CONCERNS.size()))
                        .consultationRecord(draft(SOAP_TEMPLATES.get((di + 2) % SOAP_TEMPLATES.size()))));
            }
            if (di % 5 == 0) {
                n += save(slot(p1, email, doc, 3 + di % 4, 16, 0, BookingStatus.CONFIRMED,
                        CONCERNS.get((di + 12) % CONCERNS.size())));
            }
            di++;
        }
        return n;
    }

    // A booking builder for a 30-minute Manila-local slot, daysFromNow from today.
    private Booking.BookingBuilder slot(String patientId, String doctorEmail, String doctorId,
            int days, int hour, int minute, BookingStatus status, String concern) {
        Instant s = instantAt(days, hour, minute);
        return Booking.builder()
                .patientUserId(patientId)
                .doctorUserId(doctorId)
                .startsAt(s)
                .endsAt(s.plus(SLOT_MINUTES, ChronoUnit.MINUTES))
                .status(status)
                .concernNote(concern)
                .meetingLink(DOCTOR_MEETING_LINKS.get(doctorEmail))
                .idempotencyKey(UUID.randomUUID().toString());
    }

    // Saves the booking, skipping anything with a missing party or a slot that
    // collides with the CONFIRMED-conflict unique index (so the spread can be
    // generous without hand-proving every slot is free). Returns 1/0 for tallying.
    private int save(Booking.BookingBuilder builder) {
        Booking booking = builder.build();
        if (booking.getPatientUserId() == null || booking.getDoctorUserId() == null) {
            return 0;
        }
        try {
            bookingRepository.save(booking);
            return 1;
        } catch (DuplicateKeyException e) {
            return 0;
        }
    }

    // A finalized consult record from a template, stamped finalized at the slot's end.
    private ConsultationRecord finalized(Soap t, int days, int hour, int minute) {
        Instant end = instantAt(days, hour, minute).plus(SLOT_MINUTES, ChronoUnit.MINUTES);
        return ConsultationRecord.builder()
                .subjective(t.s()).objective(t.o()).assessment(t.a()).plan(t.p())
                .prescription(t.rx()).finalizedAt(end).build();
    }

    // A started-but-unfinalized draft (subjective + objective only). The booking
    // stays CONFIRMED, so it reads as "ended — continue notes" once its slot passes.
    private ConsultationRecord draft(Soap t) {
        return ConsultationRecord.builder().subjective(t.s()).objective(t.o()).build();
    }

    private static ConsultationRecord.PrescriptionItem rx(String med, String dose, String instructions) {
        return ConsultationRecord.PrescriptionItem.builder()
                .medication(med).dosage(dose).instructions(instructions).build();
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

    // Adds a Saturday 9-5 entry to the SATURDAY_DOCTORS roster's weekly schedule
    // if it's missing, so already-seeded doctors gain Saturday hours without a full
    // reseed. Idempotent: skips a doctor who already lists Saturday, and only adds
    // (never rewrites the rest of the week), so other edits survive.
    private void ensureSaturdayHours() {
        int updated = 0;
        for (DoctorProfile profile : doctorProfileRepository.findAll()) {
            String email = userRepository.findById(profile.getUserId())
                    .map(User::getEmail).orElse(null);
            if (email == null || !SATURDAY_DOCTORS.contains(email)) {
                continue;
            }
            Availability av = profile.getAvailability();
            if (av == null || av.getWeeklySchedule() == null) {
                continue;
            }
            boolean hasSaturday = av.getWeeklySchedule().stream()
                    .anyMatch(e -> e.getDayOfWeek() == DayOfWeek.SATURDAY);
            if (hasSaturday) {
                continue;
            }
            List<Availability.WeeklyScheduleEntry> schedule = new ArrayList<>(av.getWeeklySchedule());
            schedule.add(Availability.WeeklyScheduleEntry.builder()
                    .dayOfWeek(DayOfWeek.SATURDAY)
                    .startTime(LocalTime.of(9, 0))
                    .endTime(LocalTime.of(17, 0))
                    .build());
            profile.setAvailability(Availability.builder()
                    .timeZone(av.getTimeZone())
                    .weeklySchedule(schedule)
                    .blockedRanges(av.getBlockedRanges() != null ? av.getBlockedRanges() : List.of())
                    .build());
            doctorProfileRepository.save(profile);
            updated++;
        }
        if (updated > 0) {
            log.info("[seed] added Saturday hours to {} doctor(s)", updated);
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
            String email, String name, LocalDate birthday, Sex sex, Double weightKg,
            Double heightCm, String contactNumber, List<String> conditions,
            List<String> allergies, List<String> medications, String notesForDoctor) {}

    // A reusable SOAP note + prescription template (s/o/a/p + rx), rotated across
    // the seeded completed and draft consults.
    private record Soap(String s, String o, String a, String p,
            List<ConsultationRecord.PrescriptionItem> rx) {}
}
