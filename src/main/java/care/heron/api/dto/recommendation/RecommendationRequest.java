package care.heron.api.dto.recommendation;

import care.heron.api.validation.MeaningfulText;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Public intake. `concern` is required and length-capped (data-minimization +
// abuse guard — no one pastes a whole chart, no one burns tokens with a megabyte
// of text). `forWhom` / `duration` are the optional step-2 refiners.
public record RecommendationRequest(
        // @NotBlank stops empty/whitespace-only; @MeaningfulText also stops a
        // control-char-only payload that @NotBlank would let through.
        @NotBlank(message = "Tell us a little about what's going on.")
        @Size(max = 1000, message = "Please keep it under 1000 characters.")
        @MeaningfulText(message = "Tell us a little about what's going on.")
        String concern,

        // Optional step-2 refiners; capped so they can't be abused as free text.
        @Size(max = 100, message = "Please keep this short.")
        String forWhom,
        @Size(max = 100, message = "Please keep this short.")
        String duration
) {}
