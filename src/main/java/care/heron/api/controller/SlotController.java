package care.heron.api.controller;

import care.heron.api.dto.slot.SlotResponse;
import care.heron.api.service.SlotService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

// Public — slot listing is part of guest doctor discovery. The
// permissive route matcher in SecurityConfig must include this path.
@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class SlotController {

    private static final int DEFAULT_WINDOW_DAYS = 14;
    private static final int MAX_WINDOW_DAYS = 31;

    private final SlotService slotService;
    private final Clock clock;

    @GetMapping("/{id}/slots")
    public List<SlotResponse> list(
            @PathVariable String id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to) {
        Instant now = clock.instant();
        Instant resolvedFrom = from != null ? from : now;
        Instant resolvedTo = to != null ? to : now.plus(DEFAULT_WINDOW_DAYS, ChronoUnit.DAYS);

        if (!resolvedFrom.isBefore(resolvedTo)) {
            throw new IllegalArgumentException("from must be before to.");
        }
        if (Duration.between(resolvedFrom, resolvedTo).toDays() > MAX_WINDOW_DAYS) {
            throw new IllegalArgumentException(
                    "Slot window cannot exceed " + MAX_WINDOW_DAYS + " days.");
        }

        return slotService.computeAvailableSlots(id, resolvedFrom, resolvedTo).stream()
                .map(SlotResponse::from)
                .toList();
    }
}
