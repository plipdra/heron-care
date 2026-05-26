package care.heron.api.security;

import care.heron.api.config.HeronProperties;
import care.heron.api.document.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {

    public enum TokenType { ACCESS, REFRESH }

    private final HeronProperties properties;
    private SecretKey signingKey;

    @PostConstruct
    void init() {
        byte[] keyBytes = Decoders.BASE64.decode(properties.jwt().secret());
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must decode to at least 256 bits (32 bytes). "
                            + "Generate with: openssl rand -base64 48");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccess(User user) {
        return generate(user, TokenType.ACCESS,
                Duration.ofMinutes(properties.jwt().accessTtlMinutes()));
    }

    public String generateRefresh(User user) {
        return generate(user, TokenType.REFRESH,
                Duration.ofDays(properties.jwt().refreshTtlDays()));
    }

    public Optional<Jws<Claims>> parse(String token) {
        try {
            return Optional.of(
                    Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public boolean isAccessToken(Claims claims) {
        return TokenType.ACCESS.name().equals(claims.get("type", String.class));
    }

    public boolean isRefreshToken(Claims claims) {
        return TokenType.REFRESH.name().equals(claims.get("type", String.class));
    }

    private String generate(User user, TokenType type, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getId())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("type", type.name())
                .signWith(signingKey)
                .compact();
    }
}
