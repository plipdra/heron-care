package care.heron.api.service;

import care.heron.api.document.Booking;
import care.heron.api.document.DoctorProfile;
import care.heron.api.document.Notification;
import care.heron.api.document.PatientProfile;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.document.enums.NotificationType;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.DoctorProfileRepository;
import care.heron.api.repository.NotificationRepository;
import care.heron.api.repository.PatientProfileRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

// Persists per-recipient notifications and pushes them live over SSE. Two halves:
//   - the WRITE side (notify / notifyAvailabilityChanged) is called from domain
//     services as a best-effort SIDE EFFECT — it never throws, so a notification
//     failure can never roll back or 500 the booking/availability write that
//     triggered it. Persistence is the source of truth; the live push is a nicety
//     (an offline recipient simply sees it on next load via the history endpoint).
//   - the STREAM side keeps a per-user registry of SseEmitters. Single-JVM, which
//     is correct for the single-service deploy; a user on a different instance
//     after a redeploy just re-hydrates from the history GET.
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L; // 30 min
    private static final int MAX_EMITTERS_PER_USER = 6;             // ~browser per-origin cap
    private static final long HEARTBEAT_SECONDS = 25;               // keep idle proxies from reaping
    private static final int FANOUT_HORIZON_DAYS = 365;

    private final NotificationRepository notificationRepository;
    private final BookingRepository bookingRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;

    private final Map<String, Collection<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "notif-heartbeat");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void startHeartbeat() {
        heartbeat.scheduleAtFixedRate(this::sweep, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        emitters.values().forEach(set -> set.forEach(SseEmitter::complete));
        emitters.clear();
    }

    // ---- stream side ----

    public SseEmitter subscribe(String userId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        Collection<SseEmitter> userEmitters =
                emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>());

        // Cap per user: evict the oldest if a client opens too many (multi-tab,
        // reconnect storm) so the registry can't grow without bound.
        while (userEmitters.size() >= MAX_EMITTERS_PER_USER) {
            var it = userEmitters.iterator();
            if (!it.hasNext()) break;
            SseEmitter oldest = it.next();
            userEmitters.remove(oldest);
            oldest.complete();
        }
        userEmitters.add(emitter);

        // Remove on EVERY termination path — completion, timeout, AND error. A
        // closed tab fires onError (broken pipe); without this the emitter leaks.
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            remove(userId, emitter);
        });
        emitter.onError(e -> remove(userId, emitter));

        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            remove(userId, emitter);
        }
        return emitter;
    }

    private void remove(String userId, SseEmitter emitter) {
        Collection<SseEmitter> set = emitters.get(userId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                emitters.remove(userId);
            }
        }
    }

    private void sweep() {
        emitters.forEach((userId, set) -> {
            for (SseEmitter emitter : set) {
                try {
                    emitter.send(SseEmitter.event().comment("hb"));
                } catch (Exception e) {
                    remove(userId, emitter);
                }
            }
        });
    }

    private void push(String recipientUserId, Notification notification) {
        Collection<SseEmitter> set = emitters.get(recipientUserId);
        if (set == null) return;
        for (SseEmitter emitter : set) {
            try {
                // Payload is just the type — the client refetches the authoritative
                // list on any event, so nothing PHI rides the wire here.
                emitter.send(SseEmitter.event().name("notification").data(notification.getType().name()));
            } catch (Exception e) {
                remove(recipientUserId, emitter);
            }
        }
    }

    // ---- write side (best-effort, never throws) ----

    // A booking event — notify the doctor (the non-actor), naming the patient.
    // The doctor already sees this patient's name on their consult list, so the
    // name is not new disclosure; clinical detail (the concern note) is never
    // included.
    public void notifyBookingEvent(NotificationType type, Booking booking) {
        try {
            String patientName = patientProfileRepository.findByUserId(booking.getPatientUserId())
                    .map(PatientProfile::getName)
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("A patient");
            persistAndPush(booking.getDoctorUserId(), type,
                    bookingMessage(type, patientName), booking.getStartsAt());
        } catch (Exception e) {
            log.warn("notification_failed recipient={} type={}", booking.getDoctorUserId(), type, e);
        }
    }

    // The patient's own booking action — a confirmation/record in THEIR notification
    // center (notifyBookingEvent above covers the doctor side). Names the doctor; no
    // clinical detail rides along. Best-effort, never throws.
    public void notifyPatientBookingEvent(NotificationType type, Booking booking) {
        try {
            String doctorName = doctorProfileRepository.findByUserId(booking.getDoctorUserId())
                    .map(DoctorProfile::getName)
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("your doctor");
            persistAndPush(booking.getPatientUserId(), type,
                    patientBookingMessage(type, doctorName), booking.getStartsAt());
        } catch (Exception e) {
            log.warn("notification_failed recipient={} type={}", booking.getPatientUserId(), type, e);
        }
    }

    // A doctor changed their availability — notify the patients with a future
    // confirmed booking (deduped), scoped to this doctor's own bookings, naming
    // the doctor. Blocking time never cancels a booking, so this is informational
    // ("review your visit"), never a cancellation.
    public void notifyAvailabilityChanged(String doctorUserId) {
        try {
            String doctorName = doctorProfileRepository.findByUserId(doctorUserId)
                    .map(DoctorProfile::getName)
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("Your doctor");
            String message = doctorName + " updated their availability.";
            Instant now = clock.instant();
            List<Booking> affected = bookingRepository.findByDoctorUserIdAndStatusAndStartsAtBetween(
                    doctorUserId, BookingStatus.CONFIRMED, now, now.plus(FANOUT_HORIZON_DAYS, ChronoUnit.DAYS));
            affected.stream()
                    .map(Booking::getPatientUserId)
                    .distinct()
                    .forEach(patientUserId -> persistAndPush(
                            patientUserId, NotificationType.AVAILABILITY_CHANGED, message, null));
        } catch (Exception e) {
            log.warn("availability_notification_failed doctor={}", doctorUserId, e);
        }
    }

    // The "upcoming visit" reminder — patient-facing, names the doctor. The time
    // rides on startsAt (formatted in the patient's local zone by the panel), so
    // the message itself carries no countdown (calm, per the brand). Throws on a
    // persistence failure so the scheduler leaves the booking unmarked and retries.
    public void notifyReminder(Booking booking) {
        String doctorName = doctorProfileRepository.findByUserId(booking.getDoctorUserId())
                .map(DoctorProfile::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElse("your doctor");
        persistAndPush(booking.getPatientUserId(), NotificationType.APPOINTMENT_REMINDER,
                "Your visit with " + doctorName + " is coming up.", booking.getStartsAt());
    }

    private void persistAndPush(String recipientUserId, NotificationType type, String message, Instant startsAt) {
        Notification saved = notificationRepository.save(Notification.builder()
                .recipientUserId(recipientUserId)
                .type(type)
                .message(message)
                .startsAt(startsAt)
                .build());
        push(recipientUserId, saved);
    }

    // ---- read side ----

    public List<Notification> list(String userId, int limit) {
        return notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(0, limit));
    }

    public long unreadCount(String userId) {
        return notificationRepository.countByRecipientUserIdAndReadAtIsNull(userId);
    }

    // Bulk mark-read scoped to the caller in the query itself — no id parameter,
    // so there is no surface to mark another user's notifications.
    public void markAllRead(String userId) {
        mongoTemplate.updateMulti(
                new Query(Criteria.where("recipientUserId").is(userId).and("readAt").is(null)),
                new Update().set("readAt", clock.instant()),
                Notification.class);
    }

    private static String bookingMessage(NotificationType type, String patientName) {
        return switch (type) {
            case BOOKING_CONFIRMED -> "New appointment with " + patientName + ".";
            case BOOKING_CANCELLED -> patientName + " cancelled their appointment.";
            case BOOKING_RESCHEDULED -> patientName + " rescheduled their appointment.";
            default -> "You have an appointment update.";
        };
    }

    private static String patientBookingMessage(NotificationType type, String doctorName) {
        return switch (type) {
            case BOOKING_CONFIRMED -> "Your appointment with " + doctorName + " is confirmed.";
            case BOOKING_CANCELLED -> "Your appointment with " + doctorName + " was cancelled.";
            case BOOKING_RESCHEDULED -> "Your appointment with " + doctorName + " was rescheduled.";
            default -> "Your appointment was updated.";
        };
    }
}
