package care.heron.api.controller;

import care.heron.api.dto.notification.NotificationListResponse;
import care.heron.api.dto.notification.NotificationResponse;
import care.heron.api.dto.notification.StreamTokenResponse;
import care.heron.api.security.JwtService;
import care.heron.api.service.NotificationService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private static final int LIST_LIMIT = 50;

    private final NotificationService notificationService;
    private final JwtService jwtService;

    // Caller's own notifications + unread count. IDOR-safe by route shape — the
    // recipient is the JWT principal, there is no addressable id here.
    @GetMapping
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public NotificationListResponse list(@AuthenticationPrincipal String userId) {
        List<NotificationResponse> items = notificationService.list(userId, LIST_LIMIT).stream()
                .map(NotificationResponse::from)
                .toList();
        return new NotificationListResponse(items, notificationService.unreadCount(userId));
    }

    // Mark all of the caller's unread as read (panel-open action). Scoped to the
    // principal in the query — no id param, so no cross-user mark surface.
    @PatchMapping("/read")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal String userId) {
        notificationService.markAllRead(userId);
    }

    // Mint a short-lived stream token (Bearer-gated). EventSource can't send the
    // Authorization header, so the client fetches this and passes it on the stream
    // URL. The token is type-isolated — useless against any other API.
    @PostMapping("/stream-token")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR')")
    public StreamTokenResponse streamToken(@AuthenticationPrincipal String userId) {
        return new StreamTokenResponse(jwtService.generateStream(userId));
    }

    // The SSE connection. permitAll in SecurityConfig (the Bearer filter can't
    // authenticate a header-less EventSource); auth happens HERE by validating the
    // stream token and binding the stream to the token's signed subject — never to
    // a request param, so one user can't open another's stream.
    @GetMapping("/stream")
    public SseEmitter stream(@RequestParam("token") String token) {
        String userId = jwtService.parse(token)
                .map(Jws::getPayload)
                .filter(jwtService::isStreamToken)
                .map(Claims::getSubject)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid or expired stream token."));
        return notificationService.subscribe(userId);
    }
}
