package care.heron.api.dto.auth;

import care.heron.api.document.enums.UserRole;
import care.heron.api.service.AuthService;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String userId,
        UserRole role
) {
    public static AuthResponse from(AuthService.AuthResult result) {
        return new AuthResponse(
                result.accessToken(),
                result.refreshToken(),
                result.userId(),
                result.role());
    }
}
