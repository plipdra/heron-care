package care.heron.api.service;

import care.heron.api.document.Booking;
import care.heron.api.document.Notification;
import care.heron.api.document.enums.BookingStatus;
import care.heron.api.document.enums.NotificationType;
import care.heron.api.repository.BookingRepository;
import care.heron.api.repository.NotificationRepository;
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

    public void notify(String recipientUserId, NotificationType type, Instant startsAt) {
        try {
            Notification saved = notificationRepository.save(Notification.builder()
                    .recipientUserId(recipientUserId)
                    .type(type)
                    .message(messageFor(type))
                    .startsAt(startsAt)
                    .build());
            push(recipientUserId, saved);
        } catch (Exception e) {
            log.warn("notification_failed recipient={} type={}", recipientUserId, type, e);
        }
    }

    // A doctor changed their availability — notify the patients with a future
    // confirmed booking (deduped), scoped to this doctor's own bookings. Blocking
    // time never cancels a booking, so this is informational ("review your visit"),
    // never a cancellation.
    public void notifyAvailabilityChanged(String doctorUserId) {
        try {
            Instant now = clock.instant();
            List<Booking> affected = bookingRepository.findByDoctorUserIdAndStatusAndStartsAtBetween(
                    doctorUserId, BookingStatus.CONFIRMED, now, now.plus(FANOUT_HORIZON_DAYS, ChronoUnit.DAYS));
            affected.stream()
                    .map(Booking::getPatientUserId)
                    .distinct()
                    .forEach(patientUserId ->
                            notify(patientUserId, NotificationType.AVAILABILITY_CHANGED, null));
        } catch (Exception e) {
            log.warn("availability_notification_failed doctor={}", doctorUserId, e);
        }
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

    private static String messageFor(NotificationType type) {
        return switch (type) {
            case BOOKING_CONFIRMED -> "A new appointment was booked with you.";
            case BOOKING_CANCELLED -> "A patient cancelled their appointment.";
            case BOOKING_RESCHEDULED -> "A patient moved their appointment to a new time.";
            case AVAILABILITY_CHANGED ->
                    "Your doctor updated their schedule. Please review your upcoming visit.";
            case APPOINTMENT_REMINDER -> "You have an upcoming appointment soon.";
        };
    }
}
