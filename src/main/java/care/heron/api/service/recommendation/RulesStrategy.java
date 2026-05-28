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
        Specialization desired = best != null ? best : Specialization.GENERAL_PRACTICE;

        // The specialty we NAME must match the doctors we SHOW. Take doctors of the
        // desired specialty; if we have none on the roster, fall back honestly to
        // General Practice — and that becomes the suggestion, so we never parade
        // off-specialty doctors under a specialty banner ("We suggest Orthopedics"
        // over a cardiologist card). GP is guaranteed to have doctors (seeded), so
        // there is no need to widen to "anyone".
        List<DoctorProfile> matched = byExperience(bySpecialty(desired, candidates));
        Specialization effective = desired;
        if (matched.isEmpty() && desired != Specialization.GENERAL_PRACTICE) {
            matched = byExperience(bySpecialty(Specialization.GENERAL_PRACTICE, candidates));
            effective = Specialization.GENERAL_PRACTICE;
        }

        String reason = SpecialtyReasons.reasonFor(effective);
        List<RecommendationOutcome.Ranked> ranked = matched.stream()
                .limit(MAX_RESULTS)
                .map(doctor -> new RecommendationOutcome.Ranked(doctor, reason))
                .toList();
        return RecommendationOutcome.of(effective, ranked);
    }

    private List<DoctorProfile> byExperience(List<DoctorProfile> doctors) {
        doctors.sort(Comparator.comparingInt(
                (DoctorProfile d) -> d.getYearsOfExperience() == null ? 0 : d.getYearsOfExperience()).reversed());
        return doctors;
    }

    private List<DoctorProfile> bySpecialty(Specialization specialization, List<DoctorProfile> candidates) {
        List<DoctorProfile> out = new ArrayList<>();
        for (DoctorProfile d : candidates) {
            if (d.getSpecialization() == specialization) out.add(d);
        }
        return out;
    }
}
