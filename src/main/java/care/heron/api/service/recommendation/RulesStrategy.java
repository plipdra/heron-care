package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// Deterministic specialty-keyword matcher — the recommendation's reliable floor.
// It is the server-side source of truth for concern→specialty (the browse-page
// "Common Concerns" chips are a curated subset of this knowledge, not a rival
// map). It needs no network, so it both ships the Required feature on its own
// AND catches every failure mode of the LLM strategy layered on top later.
@Component
public class RulesStrategy implements DoctorRecommendationStrategy {

    private static final int MAX_RESULTS = 4;

    // Keyword → specialty. Hits score each specialty; the top score wins. Listed
    // specific-first so the iteration favours a more specific specialty on a tie.
    private static final Map<Specialization, List<String>> KEYWORDS = buildKeywords();

    private static Map<Specialization, List<String>> buildKeywords() {
        Map<Specialization, List<String>> m = new LinkedHashMap<>();
        m.put(Specialization.CARDIOLOGY, List.of("chest pain", "palpitation", "heart", "blood pressure", "hypertension"));
        m.put(Specialization.DERMATOLOGY, List.of("rash", "acne", "skin", "eczema", "mole", "itch"));
        m.put(Specialization.PSYCHIATRY, List.of("anxiety", "depress", "low mood", "panic", "stress", "mental", "insomnia"));
        m.put(Specialization.NEUROLOGY, List.of("headache", "migraine", "dizziness", "numbness", "seizure", "memory"));
        m.put(Specialization.OB_GYN, List.of("pregnan", "menstru", "period", "gynaecolog", "gynecolog", "prenatal"));
        m.put(Specialization.PEDIATRICS, List.of("child", "kid", "baby", "infant", "my son", "my daughter", "pediatric", "paediatric"));
        m.put(Specialization.ORTHOPEDICS, List.of("joint", "knee", "back pain", "bone", "fracture", "sprain", "shoulder", "ankle"));
        m.put(Specialization.ENDOCRINOLOGY, List.of("thyroid", "diabet", "hormone", "weight gain", "weight loss"));
        m.put(Specialization.INTERNAL_MEDICINE, List.of("fever", "cough", "cold", "flu", "stomach", "nausea", "fatigue", "digest"));
        return m;
    }

    @Override
    public RecommendationOutcome recommend(RecommendationQuery query, List<DoctorProfile> candidates) {
        String concern = query.concern() == null ? "" : query.concern().toLowerCase(Locale.ROOT);

        Specialization best = null;
        int bestScore = 0;
        for (Map.Entry<Specialization, List<String>> entry : KEYWORDS.entrySet()) {
            int score = 0;
            for (String keyword : entry.getValue()) {
                if (concern.contains(keyword)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                best = entry.getKey();
            }
        }

        // "Who is this for?" — a child concern routes to Pediatrics regardless.
        if ("CHILD".equalsIgnoreCase(query.forWhom())) {
            best = Specialization.PEDIATRICS;
        }

        // No signal → General Practice is the safe, useful default (never "no match").
        Specialization suggested = best != null ? best : Specialization.GENERAL_PRACTICE;

        String reason = reasonFor(suggested);
        List<RecommendationOutcome.Ranked> ranked = pickDoctors(suggested, candidates).stream()
                .limit(MAX_RESULTS)
                .map(doctor -> new RecommendationOutcome.Ranked(doctor, reason))
                .toList();
        return new RecommendationOutcome(suggested, ranked);
    }

    // Doctors of the suggested specialty, ranked by experience; gracefully widen to
    // GP, then to anyone, so the result is never empty.
    private List<DoctorProfile> pickDoctors(Specialization suggested, List<DoctorProfile> candidates) {
        List<DoctorProfile> matched = bySpecialty(suggested, candidates);
        if (matched.isEmpty() && suggested != Specialization.GENERAL_PRACTICE) {
            matched = bySpecialty(Specialization.GENERAL_PRACTICE, candidates);
        }
        if (matched.isEmpty()) {
            matched = new ArrayList<>(candidates);
        }
        matched.sort(Comparator.comparingInt(
                (DoctorProfile d) -> d.getYearsOfExperience() == null ? 0 : d.getYearsOfExperience()).reversed());
        return matched;
    }

    private List<DoctorProfile> bySpecialty(Specialization specialization, List<DoctorProfile> candidates) {
        List<DoctorProfile> out = new ArrayList<>();
        for (DoctorProfile d : candidates) {
            if (d.getSpecialization() == specialization) out.add(d);
        }
        return out;
    }

    private String reasonFor(Specialization specialization) {
        return switch (specialization) {
            case CARDIOLOGY -> "Cardiologists focus on the heart and chest-related concerns.";
            case DERMATOLOGY -> "Dermatologists handle skin, hair, and nail concerns.";
            case PSYCHIATRY -> "Psychiatrists support mental health and mood concerns.";
            case NEUROLOGY -> "Neurologists focus on the nervous system, including headaches and dizziness.";
            case OB_GYN -> "OB-GYNs care for reproductive and pregnancy-related health.";
            case PEDIATRICS -> "Pediatricians care for infants, children, and teens.";
            case ORTHOPEDICS -> "Orthopedic doctors handle bones, joints, and muscles.";
            case ENDOCRINOLOGY -> "Endocrinologists manage hormones, the thyroid, and diabetes.";
            case INTERNAL_MEDICINE -> "Internal medicine doctors handle a broad range of adult health concerns.";
            case GENERAL_PRACTICE -> "A general practice doctor is a good starting point and can refer you onward.";
        };
    }
}
