package care.heron.api.dto.slot;

import care.heron.api.service.SlotService;

import java.time.Instant;

public record SlotResponse(Instant startsAt, Instant endsAt) {
    public static SlotResponse from(SlotService.Slot slot) {
        return new SlotResponse(slot.startsAt(), slot.endsAt());
    }
}
