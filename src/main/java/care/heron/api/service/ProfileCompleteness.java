package care.heron.api.service;

import care.heron.api.document.Availability;
import care.heron.api.document.DoctorProfile;

// Single source of truth for "is this doctor profile complete enough to be
// publicly listed and booked?" — reused by the save path (to set the published
// flag) and the startup backfill. A complete profile reads as a credible,
// bookable provider; this gate keeps incomplete or test accounts (no bio, no
// meeting link, no availability) out of discovery and AI recommendations.
public final class ProfileCompleteness {

    private ProfileCompleteness() {}

    public static boolean isDoctorPublishable(DoctorProfile p) {
        if (p == null) return false;
        return notBlank(p.getName())
                && notBlank(p.getBio())
                && p.getSpecialization() != null
                && p.getYearsOfExperience() != null
                && notBlank(p.getDefaultMeetingLink())
                && hasSchedule(p.getAvailability());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean hasSchedule(Availability a) {
        return a != null
                && a.getTimeZone() != null
                && a.getWeeklySchedule() != null
                && !a.getWeeklySchedule().isEmpty();
    }
}
