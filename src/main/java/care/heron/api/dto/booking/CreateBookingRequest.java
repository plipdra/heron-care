package care.heron.api.dto.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateBookingRequest(
        @NotBlank(message = "doctorUserId is required.")
        String doctorUserId,

        @NotNull(message = "startsAt is required.")
        Instant startsAt,

        @Size(max = 1000, message = "concernNote must not exceed 1000 characters.")
        String concernNote
) {}
