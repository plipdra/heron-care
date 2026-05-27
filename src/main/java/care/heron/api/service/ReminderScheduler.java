package care.heron.api.service;

import care.heron.api.document.Booking;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

// Sends the "upcoming visit" reminder (the spec's third notification trigger,
// alongside booked + schedule-updates). A once-a-minute sweep finds CONFIRMED
// bookings entering the next hour that haven't been reminded, notifies the
// patient, and stamps reminderSentAt so it never fires twice.
//
// Single-instance by design: the deploy is one service jar, so a plain
// @Scheduled sweep + the reminderSentAt marker is sufficient. At horizontal
// scale this would move to a distributed scheduler / queue with a lease — a
// documented Future Work boundary, the same single-JVM assumption the SSE
// emitter registry makes.
@Component
@RequiredArgsConstructor
@Slf4j
public class ReminderScheduler {

    private static final long REMINDER_WINDOW_MINUTES = 60;

    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    @Scheduled(fixedDelayString = "60000")
    public void sweep() {
        Instant now = clock.instant();
        Instant windowEnd = now.plus(REMINDER_WINDOW_MINUTES, ChronoUnit.MINUTES);
        List<Booking> due = bookingRepository.findByStatusAndReminderSentAtIsNullAndStartsAtBetween(
                BookingStatus.CONFIRMED, now, windowEnd);

        for (Booking booking : due) {
            try {
                // Notify first; only mark sent once the notification persisted, so
                // a persistence failure retries on the next sweep rather than being
                // silently swallowed. (An optimistic-lock failure here — the booking
                // was cancelled/rescheduled concurrently — is caught and skipped,
                // which is correct: that booking no longer needs this reminder.)
                notificationService.notifyReminder(booking);
                booking.setReminderSentAt(now);
                bookingRepository.save(booking);
            } catch (Exception e) {
                log.warn("reminder_failed bookingId={}", booking.getId(), e);
            }
        }
    }
}
