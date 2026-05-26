package care.heron.api.controller;

import care.heron.api.document.ProfilePicture;
import care.heron.api.dto.profile.UploadProfilePictureRequest;
import care.heron.api.service.ProfilePictureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

// Picture bytes live behind an authenticated endpoint — patient avatars are
// PII for a healthcare app, and symmetric auth-gating sidesteps the question
// of which users are "public enough." Cache-Control is private + short
// max-age so a logged-in browser doesn't refetch on every page nav but
// shared caches (CDN, proxy) never store it.
@RestController
@RequestMapping("/api/profile-pictures")
@RequiredArgsConstructor
public class ProfilePictureController {

    private final ProfilePictureService service;

    @GetMapping("/{userId}")
    public ResponseEntity<byte[]> get(@PathVariable String userId) {
        return service.get(userId)
                .map(this::toResponse)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/me")
    public ResponseEntity<Void> upload(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UploadProfilePictureRequest request) {
        service.upload(userId, request.dataUrl());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId) {
        service.delete(userId);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<byte[]> toResponse(ProfilePicture picture) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(picture.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .eTag("\"" + picture.getUpdatedAt().toEpochMilli() + "\"")
                .lastModified(picture.getUpdatedAt())
                .body(picture.getData());
    }
}
