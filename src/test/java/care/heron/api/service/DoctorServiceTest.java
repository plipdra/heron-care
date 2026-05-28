package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.repository.DoctorProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/*
 * The availability write path is the ONLY gate protecting slot derivation:
 * SlotService and BookingService.validateSlot trust the stored availability
 * blindly, so a malformed schedule that slips through here corrupts the
 * booking surface (silent no-slots, a block that blocks nothing, or a
 * slot the booking gate then rejects). These tests defend the cross-field
 * invariants that Bean Validation can't express. timeZone is never taken
 * from the request — it is preserved from the persisted profile.
 */
@ExtendWith(MockitoExtension.class)
class DoctorServiceTest {

    @Mock DoctorProfileRepository doctorProfileRepository;
    @Mock NotificationService notificationService;

    static final String DOCTOR_USER_ID = "doctor-001";
    static final Instant NOW = Instant.parse("2026-05-27T10:00:00Z");

    DoctorService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new DoctorService(doctorProfileRepository, notificationService, clock);
    }

    @Test
    void saves_a_valid_schedule_and_preserves_the_existing_timezone() {
        givenExistingDoctor();
        given(doctorProfileRepository.save(any(DoctorProfile.class)))
                .willAnswer(inv -> inv.getArgument(0));

        DoctorProfile result = service.updateMyAvailability(DOCTOR_USER_ID, command(
                List.of(weekly(DayOfWeek.MONDAY, "09:00", "17:00"),
                        weekly(DayOfWeek.SATURDAY, "10:00", "14:00")),
                List.of(blocked("2026-06-01T01:00:00Z", "2026-06-01T09:00:00Z"))));

        Availability saved = result.getAvailability();
        assertThat(saved.getTimeZone()).isEqualTo("Asia/Manila");
        assertThat(saved.getWeeklySchedule()).hasSize(2);
        assertThat(saved.getBlockedRanges()).hasSize(1);
    }

    @Test
    void rejects_working_hours_that_end_before_they_start() {
        givenExistingDoctor();

        assertThatThrownBy(() -> service.updateMyAvailability(DOCTOR_USER_ID, command(
                List.of(weekly(DayOfWeek.MONDAY, "17:00", "09:00")), List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(doctorProfileRepository, never()).save(any());
    }

    @Test
    void rejects_more_than_one_set_of_hours_for_the_same_day() {
        givenExistingDoctor();

        assertThatThrownBy(() -> service.updateMyAvailability(DOCTOR_USER_ID, command(
                List.of(weekly(DayOfWeek.MONDAY, "09:00", "12:00"),
                        weekly(DayOfWeek.MONDAY, "13:00", "17:00")),
                List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(doctorProfileRepository, never()).save(any());
    }

    @Test
    void rejects_a_time_off_range_that_ends_before_it_starts() {
        givenExistingDoctor();

        assertThatThrownBy(() -> service.updateMyAvailability(DOCTOR_USER_ID, command(
                List.of(weekly(DayOfWeek.MONDAY, "09:00", "17:00")),
                List.of(blocked("2026-06-02T09:00:00Z", "2026-06-01T09:00:00Z")))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(doctorProfileRepository, never()).save(any());
    }

    @Test
    void rejects_time_off_beyond_the_two_year_horizon() {
        givenExistingDoctor();

        assertThatThrownBy(() -> service.updateMyAvailability(DOCTOR_USER_ID, command(
                List.of(weekly(DayOfWeek.MONDAY, "09:00", "17:00")),
                List.of(blocked("2028-06-01T00:00:00Z", "2028-06-02T00:00:00Z")))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(doctorProfileRepository, never()).save(any());
    }

    @Test
    void updateMine_publishes_a_complete_profile() {
        given(doctorProfileRepository.findByUserId(DOCTOR_USER_ID))
                .willReturn(Optional.of(DoctorProfile.builder()
                        .userId(DOCTOR_USER_ID)
                        .name("Dr Complete")
                        .bio("Experienced clinician.")
                        .specialization(Specialization.CARDIOLOGY)
                        .yearsOfExperience(10)
                        .defaultMeetingLink("https://meet.google.com/abc-defg-hij")
                        .availability(Availability.defaultBusinessHours())
                        .build()));
        given(doctorProfileRepository.save(any(DoctorProfile.class)))
                .willAnswer(inv -> inv.getArgument(0));

        DoctorProfile result = service.updateMine(DOCTOR_USER_ID,
                new DoctorService.UpdateDoctorProfileCommand(null, null, null, null, null));

        assertThat(result.isPublished()).isTrue();
    }

    @Test
    void updateMine_does_not_publish_an_incomplete_profile() {
        given(doctorProfileRepository.findByUserId(DOCTOR_USER_ID))
                .willReturn(Optional.of(DoctorProfile.builder()
                        .userId(DOCTOR_USER_ID)
                        .name("Dr Incomplete") // no bio, specialization, years, link, or availability
                        .build()));
        given(doctorProfileRepository.save(any(DoctorProfile.class)))
                .willAnswer(inv -> inv.getArgument(0));

        DoctorProfile result = service.updateMine(DOCTOR_USER_ID,
                new DoctorService.UpdateDoctorProfileCommand(null, null, null, null, null));

        assertThat(result.isPublished()).isFalse();
    }

    private void givenExistingDoctor() {
        given(doctorProfileRepository.findByUserId(DOCTOR_USER_ID))
                .willReturn(Optional.of(DoctorProfile.builder()
                        .id("doc-profile-001")
                        .userId(DOCTOR_USER_ID)
                        .name("Dr Test")
                        .availability(Availability.defaultBusinessHours())
                        .build()));
    }

    private DoctorService.UpdateAvailabilityCommand command(
            List<Availability.WeeklyScheduleEntry> weekly,
            List<Availability.BlockedRange> blocked) {
        return new DoctorService.UpdateAvailabilityCommand(weekly, blocked);
    }

    private Availability.WeeklyScheduleEntry weekly(DayOfWeek day, String start, String end) {
        return Availability.WeeklyScheduleEntry.builder()
                .dayOfWeek(day)
                .startTime(LocalTime.parse(start))
                .endTime(LocalTime.parse(end))
                .build();
    }

    private Availability.BlockedRange blocked(String startsAt, String endsAt) {
        return Availability.BlockedRange.builder()
                .startsAt(Instant.parse(startsAt))
                .endsAt(Instant.parse(endsAt))
                .reason("Time off")
                .build();
    }
}
