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
            "stabbed", "stab wound", "gunshot", "anaphyla");

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
        return RED_FLAGS.stream().anyMatch(c::contains);
    }
}
