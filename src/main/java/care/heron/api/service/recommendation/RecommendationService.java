package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.dto.doctor.PublicDoctorResponse;
import care.heron.api.dto.recommendation.RankedDoctorResponse;
import care.heron.api.dto.recommendation.RecommendationResponse;
import care.heron.api.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

// Orchestrates a recommendation: a deterministic red-flag screen FIRST (so an
// emergency never gets cheerfully routed to a specialist, which would imply a
// triage the app must not perform), then rank a capped candidate set via the
// strategy. The strategy returns the same shape whether it's rules or the LLM, so
// this service — and the UI — never branch on which ran.
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private static final int CANDIDATE_CAP = 50;

    // Best-effort, NOT a triage system. Unambiguous emergency / crisis phrasing
    // short-circuits to a calm safety notice instead of a doctor recommendation.
    // Deliberately narrow (e.g. not bare "chest pain", which is a valid cardiology
    // concern) to avoid over-triggering. Entries are multi-word phrases wherever a
    // single word would substring-match a benign one: bare "dying" hides in
    // "studying", "stab" in "stable"/"establish", "to death" in "worried to death".
    private static final List<String> RED_FLAGS = List.of(
            // Self-harm / suicide
            "suicid", "kill myself", "kill my self", "end my life", "want to die",
            "self-harm", "self harm", "overdose",
            // Cardiac / respiratory
            "heart attack", "stroke", "can't breathe", "cant breathe", "can not breathe",
            "cannot breathe", "difficulty breathing", "trouble breathing",
            "not breathing", "stopped breathing", "choking",
            // Loss of consciousness
            "unconscious", "passed out", "unresponsive", "collapsed",
            "won't wake up", "wont wake up", "not waking up",
            // Severe bleeding
            "severe bleeding", "bleeding heavily", "bleeding out", "bleeding to death",
            "won't stop bleeding", "wont stop bleeding", "can't stop the bleeding",
            "cant stop the bleeding",
            // Imminent-death phrasing
            "will die", "going to die", "gonna die", "about to die", "is dying",
            // Acute trauma / severe allergic reaction
            "stabbed", "stab wound", "gunshot", "anaphyla",
            // Heart-attack / stroke DESCRIPTIONS (the symptoms, not just the labels)
            "crushing chest pain", "face drooping", "facial droop", "face is drooping",
            "drooping on one side", "slurred speech", "slurred words", "slurring my words",
            "speech is slurred", "sudden numbness", "sudden weakness", "numb on one side",
            "weak on one side", "one side of my face", "one side of my body",
            "worst headache of my life", "thunderclap headache");

    // A heart attack usually arrives as a CONSTELLATION, not the words "heart attack":
    // a chest symptom PLUS a classic feature (radiation, arm, shortness of breath,
    // sweating, jaw). Bare "chest pain" stays a normal cardiology concern — it's the
    // combination that trips the screen, so we don't over-trigger on routine chest pain.
    private static final List<String> CHEST_PAIN_TERMS = List.of(
            "chest pain", "chest tightness", "chest pressure", "tight chest",
            "tightness in my chest", "tightness in chest", "pain in my chest",
            "pain in chest", "crushing chest");
    private static final List<String> HEART_ATTACK_FEATURES = List.of(
            "left arm", "down my arm", "radiat", "shortness of breath",
            "short of breath", "sweat", "clammy", "cold sweat", "jaw");

    private static final String SAFETY_NOTICE =
            "If this could be an emergency, please call your local emergency number now "
                    + "(911 in the US, 117 in the Philippines). If you're in crisis or thinking "
                    + "about harming yourself, please reach out to a crisis line right away. "
                    + "Heron helps you find a doctor — it isn't built for emergencies.";

    private final DoctorService doctorService;
    private final DoctorRecommendationStrategy strategy;

    public RecommendationResponse recommend(RecommendationQuery query) {
        if (isRedFlag(query.concern())) {
            return RecommendationResponse.urgent(SAFETY_NOTICE);
        }

        List<DoctorProfile> candidates = doctorService
                .listPublic(null, null, PageRequest.of(0, CANDIDATE_CAP))
                .getContent();

        RecommendationOutcome outcome = strategy.recommend(query, candidates);

        // Second line of defence: the LLM can flag an emergency the keyword screen
        // missed (a novel description of a heart attack/stroke). Either signal wins.
        if (outcome.emergency()) {
            return RecommendationResponse.urgent(SAFETY_NOTICE);
        }

        List<RankedDoctorResponse> doctors = outcome.doctors().stream()
                .map(r -> new RankedDoctorResponse(PublicDoctorResponse.from(r.doctor()), r.reason()))
                .toList();
        Specialization suggested = outcome.suggestedSpecialization();
        String label = suggested != null ? suggested.displayName() : null;

        return new RecommendationResponse(false, null, label, doctors);
    }

    private boolean isRedFlag(String concern) {
        if (concern == null) return false;
        String c = concern.toLowerCase(Locale.ROOT);
        if (RED_FLAGS.stream().anyMatch(c::contains)) {
            return true;
        }
        // Heart-attack constellation: a chest symptom AND a classic feature.
        boolean chestSymptom = CHEST_PAIN_TERMS.stream().anyMatch(c::contains);
        boolean heartAttackFeature = HEART_ATTACK_FEATURES.stream().anyMatch(c::contains);
        return chestSymptom && heartAttackFeature;
    }
}
