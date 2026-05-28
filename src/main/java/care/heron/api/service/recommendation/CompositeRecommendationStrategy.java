package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

// The strategy the service actually uses (@Primary): try the LLM, fall back to the
// deterministic rules on ANY failure — timeout, exception, invalid/empty result.
// The LLM runs on a worker with a hard timeout so a slow or hung Gemini call can
// never stall the request; the rules floor returns instantly. Result: the endpoint
// is effectively un-failable, and the UX never sees which strategy answered.
@Component
@Primary
@Slf4j
class CompositeRecommendationStrategy implements DoctorRecommendationStrategy {

    // The Lite model answers in well under a second; this is generous headroom
    // for a cold connection or a transient slow call, not the expected latency.
    private static final long LLM_TIMEOUT_SECONDS = 10;

    private final LlmStrategy llm;
    private final RulesStrategy rules;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "rec-llm");
        t.setDaemon(true);
        return t;
    });

    CompositeRecommendationStrategy(LlmStrategy llm, RulesStrategy rules) {
        this.llm = llm;
        this.rules = rules;
    }

    @Override
    public RecommendationOutcome recommend(RecommendationQuery query, List<DoctorProfile> candidates) {
        if (candidates.isEmpty()) {
            return rules.recommend(query, candidates);
        }
        Future<RecommendationOutcome> future = executor.submit(() -> llm.recommend(query, candidates));
        try {
            RecommendationOutcome outcome = future.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (outcome == null || outcome.doctors().isEmpty()) {
                throw new IllegalStateException("empty LLM outcome");
            }
            return outcome;
        } catch (Exception e) {
            future.cancel(true);
            log.warn("recommendation_llm_fallback reason={}", e.getClass().getSimpleName());
            return rules.recommend(query, candidates);
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
