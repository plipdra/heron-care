package care.heron.api.service.recommendation;

// The patient's intake, decoupled from the request DTO. `concern` is the free
// text; `forWhom` / `duration` are the optional step-2 refiners (nullable) — the
// same query shape supports a single-input flow and a guided two-step flow with
// no contract change.
public record RecommendationQuery(String concern, String forWhom, String duration) {}
