package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.Availability.BlockedRange;
import care.heron.api.document.Availability.WeeklyScheduleEntry;
import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.DoctorProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Derives available 30-min slots on the fly from a doctor's availability
// rules and existing confirmed bookings. Slots are never materialised —
// this is one read against (doctor_profiles, bookings), not a scheduled
// job that pre-populates a slot table.
//
// Slot start times are aligned to half-hour boundaries in the doctor's
// local timezone (Availability.timeZone). The returned Instants are UTC.
@Service
@RequiredArgsConstructor
public class SlotService {

    public static final int SLOT_DURATION_MINUTES = 30;

    private final DoctorProfileRepository doctorProfileRepository;
    private final BookingRepository bookingRepository;
    private final Clock clock;

    public List<Slot> computeAvailableSlots(String doctorProfileId, Instant from, Instant to) {
        DoctorProfile doctor = doctorProfileRepository.findById(doctorProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", doctorProfileId));
        return computeFor(doctor, from, to);
    }

    public List<Slot> computeFor(DoctorProfile doctor, Instant from, Instant to) {
        Availability availability = doctor.getAvailability();
        if (availability == null || availability.getWeeklySchedule() == null
                || availability.getTimeZone() == null) {
            return List.of();
        }

        ZoneId zone = ZoneId.of(availability.getTimeZone());
        Map<java.time.DayOfWeek, WeeklyScheduleEntry> byDay = indexByDay(availability.getWeeklySchedule());

        // Pre-fetch confirmed bookings in window. Single query, no N+1 risk
        // when this service is later called by a list endpoint over many
        // doctors via the same pattern.
        List<Booking> confirmed = bookingRepository.findByDoctorUserIdAndStatusAndStartsAtBetween(
                doctor.getUserId(), BookingStatus.CONFIRMED, from, to);
        Set<Instant> bookedStarts = new HashSet<>();
        for (Booking b : confirmed) {
            bookedStarts.add(b.getStartsAt());
        }

        Instant now = clock.instant();
        LocalDate startDate = from.atZone(zone).toLocalDate();
        LocalDate endDate = to.atZone(zone).toLocalDate();
        List<BlockedRange> blocked = availability.getBlockedRanges() != null
                ? availability.getBlockedRanges()
                : List.of();

        List<Slot> slots = new ArrayList<>();
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            WeeklyScheduleEntry entry = byDay.get(date.getDayOfWeek());
            if (entry == null) continue;

            LocalDateTime dayStart = LocalDateTime.of(date, entry.getStartTime());
            LocalDateTime dayEnd = LocalDateTime.of(date, entry.getEndTime());

            for (LocalDateTime slotStart = dayStart;
                    slotStart.plusMinutes(SLOT_DURATION_MINUTES).compareTo(dayEnd) <= 0;
                    slotStart = slotStart.plusMinutes(SLOT_DURATION_MINUTES)) {
                Instant startsAt = slotStart.atZone(zone).toInstant();
                Instant endsAt = slotStart.plusMinutes(SLOT_DURATION_MINUTES).atZone(zone).toInstant();

                if (startsAt.isBefore(now)) continue;
                if (startsAt.isBefore(from)) continue;
                if (endsAt.isAfter(to)) continue;
                if (bookedStarts.contains(startsAt)) continue;
                if (isBlocked(startsAt, endsAt, blocked)) continue;

                slots.add(new Slot(startsAt, endsAt));
            }
        }
        return slots;
    }

    private Map<java.time.DayOfWeek, WeeklyScheduleEntry> indexByDay(List<WeeklyScheduleEntry> entries) {
        Map<java.time.DayOfWeek, WeeklyScheduleEntry> map = new HashMap<>();
        for (WeeklyScheduleEntry entry : entries) {
            map.putIfAbsent(entry.getDayOfWeek(), entry);
        }
        return map;
    }

    private boolean isBlocked(Instant startsAt, Instant endsAt, List<BlockedRange> ranges) {
        for (BlockedRange range : ranges) {
            if (range.getStartsAt() == null || range.getEndsAt() == null) continue;
            // Half-open overlap test.
            if (startsAt.isBefore(range.getEndsAt()) && endsAt.isAfter(range.getStartsAt())) {
                return true;
            }
        }
        return false;
    }

    public record Slot(Instant startsAt, Instant endsAt) {}
}
