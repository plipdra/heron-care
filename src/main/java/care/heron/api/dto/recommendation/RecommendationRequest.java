package care.heron.api.dto.recommendation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Public intake. `concern` is required and length-capped (data-minimization +
// abuse guard — no one pastes a whole chart, no one burns tokens with a megabyte
// of text). `forWhom` / `duration` are the optional step-2 refiners.
public record RecommendationRequest(
        @NotBlank(message = "Tell us a little about what's going on.")
        @Size(max = 1000, message = "Please keep it under 1000 characters.")
        String concern,

        String forWhom,
        String duration
) {}
