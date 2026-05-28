package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

// Calls Gemini (via Spring AI's ChatClient against the OpenAI-compatible endpoint)
// to choose a specialization and rank the candidate doctors. The model's output is
// treated as UNTRUSTED: the specialization must be a real enum value and the only
// doctors surfaced are ones of that specialty that exist in the candidate set we
// sent — anything hallucinated is dropped, and any failure throws so the composite
// falls back to rules. The displayed reason is server-templated (SpecialtyReasons),
// so no model-authored clinical prose ever reaches the patient.
@Component
class LlmStrategy implements DoctorRecommendationStrategy {

    private static final int MAX_RESULTS = 4;

    private static final String SYSTEM = """
            You route patients to the right TYPE of doctor in a telehealth directory.
            Given a concern and a list of candidate doctors, choose the single most
            appropriate specialization and select the best-matching doctors.

            Rules you must follow:
            - Recommend a TYPE of doctor only. Never diagnose, never describe or guess
              the patient's condition, never give medical or treatment advice.
            - Choose the specialization from EXACTLY this set: GENERAL_PRACTICE,
              INTERNAL_MEDICINE, PEDIATRICS, OB_GYN, CARDIOLOGY, DERMATOLOGY,
              PSYCHIATRY, NEUROLOGY, ORTHOPEDICS, ENDOCRINOLOGY.
            - Only return doctorIds that appear verbatim in the candidate list.
            - If the concern is about a child, prefer PEDIATRICS.
            - Set "emergency" to true ONLY when the concern clearly describes an
              acute, immediately life-threatening situation happening now — for
              example: severe or crushing chest pain with radiation, sweating, or
              breathlessness (a heart attack); face drooping, slurred speech, or
              sudden one-sided weakness or numbness (a stroke); severe difficulty
              breathing; severe or uncontrolled bleeding; a severe allergic
              reaction; loss of consciousness; or active intent to self-harm.
              Do NOT set it for mild, occasional, chronic, or exertional symptoms
              (for example occasional chest pain on exertion, or a long-standing
              headache) — those should be routed to the right specialist for a
              booking. When it is not clearly an emergency, set it to false.
            """;

    private final ChatClient chatClient;

    LlmStrategy(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @Override
    public RecommendationOutcome recommend(RecommendationQuery query, List<DoctorProfile> candidates) {
        String candidateList = candidates.stream()
                .map(d -> "- id=%s | %s | specialization=%s | years=%s".formatted(
                        d.getId(),
                        d.getName(),
                        d.getSpecialization(),
                        d.getYearsOfExperience() == null ? "?" : d.getYearsOfExperience()))
                .collect(Collectors.joining("\n"));
        String forWhom = (query.forWhom() == null || query.forWhom().isBlank())
                ? "unspecified" : query.forWhom();

        LlmRecommendation result = chatClient.prompt()
                .system(SYSTEM)
                .user(u -> u.text("""
                        Patient concern: {concern}
                        For whom: {forWhom}
                        Candidate doctors (choose only from these ids):
                        {candidates}
                        """)
                        .param("concern", query.concern() == null ? "" : query.concern())
                        .param("forWhom", forWhom)
                        .param("candidates", candidateList))
                .call()
                .entity(LlmRecommendation.class);

        return toOutcome(result, candidates);
    }

    private RecommendationOutcome toOutcome(LlmRecommendation result, List<DoctorProfile> candidates) {
        if (result == null) {
            throw new IllegalStateException("LLM returned nothing");
        }
        // An LLM-detected emergency short-circuits to the safety notice — no
        // specialty or doctor list needed (the service ignores them when urgent).
        if (result.emergency()) {
            return RecommendationOutcome.emergencyOutcome();
        }
        if (result.suggestedSpecialization() == null) {
            throw new IllegalStateException("LLM returned no specialization");
        }
        // valueOf throws IllegalArgumentException on a hallucinated/out-of-enum value → fallback.
        Specialization suggested = Specialization.valueOf(
                result.suggestedSpecialization().trim().toUpperCase(Locale.ROOT));

        List<String> ids = result.doctorIds() == null ? List.of() : result.doctorIds();
        Map<String, Integer> rank = new HashMap<>();
        for (int i = 0; i < ids.size(); i++) {
            rank.putIfAbsent(ids.get(i), i);
        }

        // Only doctors of the suggested specialty that we actually offer, ordered by
        // the model's ranking, then by experience. Coherent (the reason matches the
        // doctors) and hallucination-proof (ids not in our set simply rank last/drop).
        List<DoctorProfile> ofSpecialty = candidates.stream()
                .filter(d -> d.getSpecialization() == suggested)
                .sorted(Comparator
                        .comparingInt((DoctorProfile d) -> rank.getOrDefault(d.getId(), Integer.MAX_VALUE))
                        .thenComparingInt(d -> d.getYearsOfExperience() == null ? 0 : -d.getYearsOfExperience()))
                .toList();

        if (ofSpecialty.isEmpty()) {
            throw new IllegalStateException("LLM specialization has no doctors in the directory");
        }

        String reason = SpecialtyReasons.reasonFor(suggested);
        List<RecommendationOutcome.Ranked> ranked = ofSpecialty.stream()
                .limit(MAX_RESULTS)
                .map(d -> new RecommendationOutcome.Ranked(d, reason))
                .toList();
        return RecommendationOutcome.of(suggested, ranked);
    }

    // Structured-output target — Spring AI's BeanOutputConverter instructs the model
    // to emit JSON matching this shape and binds the reply into it.
    record LlmRecommendation(
            String suggestedSpecialization, List<String> doctorIds, boolean emergency) {}
}
