package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The publish gate's predicate, exhaustively: a complete profile is publishable,
// and dropping ANY required field (or leaving availability empty) makes it not —
// so an incomplete or test account can never slip into discovery/recommendations.
class ProfileCompletenessTest {

    private DoctorProfile.DoctorProfileBuilder complete() {
        return DoctorProfile.builder()
                .name("Maria Reyes, MD")
                .bio("Board-certified cardiologist with a focus on preventive care.")
                .specialization(Specialization.CARDIOLOGY)
                .yearsOfExperience(12)
                .defaultMeetingLink("https://meet.google.com/abc-defg-hij")
                .availability(Availability.defaultBusinessHours());
    }

    @Test
    void a_complete_profile_is_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().build())).isTrue();
    }

    @Test
    void null_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(null)).isFalse();
    }

    @Test
    void missing_name_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().name(null).build())).isFalse();
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().name("  ").build())).isFalse();
    }

    @Test
    void missing_bio_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().bio(null).build())).isFalse();
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().bio("  ").build())).isFalse();
    }

    @Test
    void missing_specialization_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().specialization(null).build())).isFalse();
    }

    @Test
    void missing_years_of_experience_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().yearsOfExperience(null).build())).isFalse();
    }

    @Test
    void missing_meeting_link_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().defaultMeetingLink(null).build())).isFalse();
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().defaultMeetingLink(" ").build())).isFalse();
    }

    @Test
    void missing_availability_is_not_publishable() {
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().availability(null).build())).isFalse();
    }

    @Test
    void availability_with_an_empty_weekly_schedule_is_not_publishable() {
        Availability noHours = Availability.builder()
                .timeZone("Asia/Manila")
                .weeklySchedule(List.of())
                .build();
        assertThat(ProfileCompleteness.isDoctorPublishable(complete().availability(noHours).build())).isFalse();
    }
}
