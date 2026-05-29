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

    // Public discovery — dispatches to the right query based on which filters are
    // set. Free text is matched token-by-token against name/bio (see searchPublished);
    // this is a keyword filter, NOT a symptom router. A pure symptom like "shoulder
    // pain" won't match a thin bio — that's the AI recommend flow's job, and the
    // empty state hands off to it.
    public Page<DoctorProfile> listPublic(
            Specialization specialization, String search, Pageable pageable) {
        boolean hasSearch = search != null && !search.isBlank();
        if (!hasSearch) {
            return specialization != null
                    ? doctorProfileRepository.findByPublishedTrueAndSpecialization(specialization, pageable)
                    : doctorProfileRepository.findByPublishedTrue(pageable);
        }

        String term = search.trim();
        // With no specialty pill selected, a term that names a specialty
        // ("neurology", "derm") filters by that specialty — the name/bio match
        // doesn't cover the specialization label, so this would otherwise come back
        // empty. A chosen pill already pins the specialty, so we skip this there.
        if (specialization == null) {
            List<Specialization> bySpecialtyTerm = matchSpecializations(term);
            if (!bySpecialtyTerm.isEmpty()) {
                return doctorProfileRepository.findByPublishedTrueAndSpecializationIn(bySpecialtyTerm, pageable);
            }
        }

        // Tokenized text search: split into words and match ANY word against name or
        // bio. "skin cancer" then hits a bio reading "…skin cancer screening", and a
        // typo'd extra word no longer zeroes out the whole query.
        List<String> tokens = tokenize(term);
        if (tokens.isEmpty()) {
            // The query was all noise (stopwords / single chars) — treat as no search.
            return specialization != null
                    ? doctorProfileRepository.findByPublishedTrueAndSpecialization(specialization, pageable)
                    : doctorProfileRepository.findByPublishedTrue(pageable);
        }
        return doctorProfileRepository.searchPublished(specialization, tokens, pageable);
    }

    // Most words a single search will act on — caps the OR fan-out so a pasted
    // paragraph can't build a pathological query.
    private static final int MAX_SEARCH_TOKENS = 10;

    // Connectors and pronouns that carry no search intent but commonly appear in
    // bios ("…joint, bone, and sports injuries"), so left in they'd match almost
    // everyone. Dropped before querying.
    private static final Set<String> SEARCH_STOPWORDS = Set.of(
            "and", "the", "for", "with", "from", "that", "this", "are", "you",
            "your", "who", "when", "what", "have", "has", "had", "was", "were",
            "can", "any", "all", "not", "but", "out");

    // Lowercase, split on whitespace, drop blanks, single characters, duplicates,
    // and stopwords. Case is irrelevant downstream (the regex match is
    // case-insensitive); lowercasing only normalises stopword comparison.
    private static List<String> tokenize(String term) {
        return Arrays.stream(term.toLowerCase(Locale.ROOT).split("\\s+"))
                .filter(t -> t.length() >= 2 && !SEARCH_STOPWORDS.contains(t))
                .distinct()
                .limit(MAX_SEARCH_TOKENS)
                .toList();
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

    // Published-gated single lookup for fully public byte surfaces (the avatar
    // endpoint). An unpublished / incomplete doctor — and any non-doctor id — is a
    // 404, so a public route built on this can never reveal a not-yet-public face.
    public DoctorProfile getPublishedProfile(String id) {
        return doctorProfileRepository.findByIdAndPublishedTrue(id)
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
