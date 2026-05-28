package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.dto.doctor.PublicDoctorResponse;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.DoctorProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DoctorService {

    // The furthest out a time-off range may extend. Guards against a single
    // [now, year-9999] range that would silently block the calendar forever.
    private static final int MAX_BLOCK_HORIZON_DAYS = 730;

    private final DoctorProfileRepository doctorProfileRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    // Public discovery — dispatches to the right repository method based on which
    // filters are set. Patch-update on profile fields means doctors don't lose
    // unrelated fields on partial submits.
    public Page<DoctorProfile> listPublic(
            Specialization specialization, String search, Pageable pageable) {
        boolean hasSearch = search != null && !search.isBlank();
        if (specialization != null && hasSearch) {
            return doctorProfileRepository
                    .findByPublishedTrueAndSpecializationAndNameContainingIgnoreCase(
                            specialization, search.trim(), pageable);
        }
        if (specialization != null) {
            return doctorProfileRepository.findByPublishedTrueAndSpecialization(specialization, pageable);
        }
        if (hasSearch) {
            String term = search.trim();
            // If the term names a specialty ("neurology", "derm"), filter by specialty:
            // the name/bio index doesn't cover the specialization label, so a specialty
            // search would otherwise come back empty.
            List<Specialization> bySpecialtyTerm = matchSpecializations(term);
            if (!bySpecialtyTerm.isEmpty()) {
                return doctorProfileRepository.findByPublishedTrueAndSpecializationIn(bySpecialtyTerm, pageable);
            }
            return doctorProfileRepository
                    .findByPublishedTrueAndNameContainingIgnoreCaseOrPublishedTrueAndBioContainingIgnoreCase(
                            term, term, pageable);
        }
        return doctorProfileRepository.findByPublishedTrue(pageable);
    }

    // Specialties whose display label or enum name contains the search term
    // (case-insensitive). Guarded to 3+ chars so a one- or two-letter query doesn't
    // sweep in half the taxonomy; "neuro", "derm", "general" resolve cleanly.
    private static List<Specialization> matchSpecializations(String term) {
        if (term.length() < 3) {
            return List.of();
        }
        String needle = term.toLowerCase(Locale.ROOT);
        return Arrays.stream(Specialization.values())
                .filter(s -> s.displayName().toLowerCase(Locale.ROOT).contains(needle)
                        || s.name().toLowerCase(Locale.ROOT).contains(needle))
                .toList();
    }

    public DoctorProfile getPublic(String id) {
        return doctorProfileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", id));
    }

    // Read-time enrichment: resolve the public display shape for a set of doctor
    // userIds in one batch query, keyed by userId. Doctors absent from the map
    // (e.g. a since-deleted profile) must be handled gracefully by the caller —
    // a historical booking still renders even if the doctor is gone.
    public Map<String, PublicDoctorResponse> publicByUserIds(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        return doctorProfileRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(DoctorProfile::getUserId, PublicDoctorResponse::from));
    }

    public DoctorProfile getMine(String userId) {
        return doctorProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor profile for user " + userId + " not found"));
    }

    // Full replace from the doctor's profile editor (same model as the patient
    // side): the form submits the complete state, so a cleared field overwrites
    // with null rather than silently keeping the old value. The published flag is
    // then recomputed — clearing a required field correctly unlists the doctor.
    public DoctorProfile updateMine(String userId, UpdateDoctorProfileCommand command) {
        DoctorProfile profile = getMine(userId);
        profile.setName(command.name());
        profile.setBio(command.bio());
        profile.setSpecialization(command.specialization());
        profile.setDefaultMeetingLink(command.defaultMeetingLink());
        profile.setYearsOfExperience(command.yearsOfExperience());
        profile.setPublished(ProfileCompleteness.isDoctorPublishable(profile));
        return doctorProfileRepository.save(profile);
    }

    // Whole-replace of the doctor's weekly schedule + time-off. The timeZone is
    // preserved from the existing record (immutable for MVP), never taken from
    // the request. Blocking a range only suppresses future slot generation — it
    // never cancels an existing confirmed booking, which is a commitment the
    // doctor honours or cancels explicitly through the booking.
    public DoctorProfile updateMyAvailability(String userId, UpdateAvailabilityCommand command) {
        DoctorProfile profile = getMine(userId);
        validateAvailability(command);

        Availability current = profile.getAvailability();
        String zone = current != null && current.getTimeZone() != null
                ? current.getTimeZone()
                : Availability.defaultBusinessHours().getTimeZone();

        profile.setAvailability(Availability.builder()
                .timeZone(zone)
                .weeklySchedule(command.weeklySchedule())
                .blockedRanges(command.blockedRanges() != null ? command.blockedRanges() : List.of())
                .build());
        profile.setPublished(ProfileCompleteness.isDoctorPublishable(profile));

        DoctorProfile saved = doctorProfileRepository.save(profile);
        // Availability changed → notify patients with a future confirmed booking
        // with this doctor. Best-effort, never throws.
        notificationService.notifyAvailabilityChanged(userId);
        return saved;
    }

    // Cross-field invariants Bean Validation can't express. These are the only
    // gate — SlotService and BookingService.validateSlot trust the stored
    // availability blindly, so a malformed write would corrupt slot derivation.
    private void validateAvailability(UpdateAvailabilityCommand command) {
        Set<DayOfWeek> seenDays = EnumSet.noneOf(DayOfWeek.class);
        for (Availability.WeeklyScheduleEntry entry : command.weeklySchedule()) {
            if (!entry.getEndTime().isAfter(entry.getStartTime())) {
                throw new IllegalArgumentException(
                        "Working hours must end after they start (" + entry.getDayOfWeek() + ").");
            }
            if (!seenDays.add(entry.getDayOfWeek())) {
                throw new IllegalArgumentException(
                        "Only one set of hours is allowed per day (" + entry.getDayOfWeek() + ").");
            }
        }

        if (command.blockedRanges() == null) return;
        Instant horizon = clock.instant().plus(MAX_BLOCK_HORIZON_DAYS, ChronoUnit.DAYS);
        for (Availability.BlockedRange range : command.blockedRanges()) {
            if (!range.getEndsAt().isAfter(range.getStartsAt())) {
                throw new IllegalArgumentException("Each time-off range must end after it starts.");
            }
            if (range.getEndsAt().isAfter(horizon)) {
                throw new IllegalArgumentException("Time-off cannot extend beyond two years from now.");
            }
        }
    }

    public record UpdateDoctorProfileCommand(
            String name,
            String bio,
            Specialization specialization,
            String defaultMeetingLink,
            Integer yearsOfExperience) {}

    public record UpdateAvailabilityCommand(
            List<Availability.WeeklyScheduleEntry> weeklySchedule,
            List<Availability.BlockedRange> blockedRanges) {}
}
