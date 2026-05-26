package care.heron.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "heron")
public record HeronProperties(Jwt jwt, Cors cors) {

    public record Jwt(String secret, int accessTtlMinutes, int refreshTtlDays) {}

    public record Cors(String allowedOrigins) {}
}
