package care.heron.api.config;

import care.heron.api.security.CorrelationIdFilter;
import care.heron.api.security.JwtAuthenticationFilter;
import care.heron.api.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(HeronProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final HeronProperties properties;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Filters created here (not @Component) so Spring Boot does not double-register
        // them in the plain servlet chain.
        CorrelationIdFilter correlationIdFilter = new CorrelationIdFilter();
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtService);

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/doctors", "/api/doctors/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        // Everything else under /api or /actuator stays authenticated.
                        .requestMatchers("/api/**", "/actuator/**").authenticated()
                        // SPA routes + static assets are public. SpaForwardController
                        // forwards unknown paths to /index.html for BrowserRouter.
                        .anyRequest().permitAll())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> writeProblem(req, res,
                                HttpStatus.UNAUTHORIZED, "Authentication required",
                                "You need to sign in to access this resource."))
                        .accessDeniedHandler((req, res, e) -> writeProblem(req, res,
                                HttpStatus.FORBIDDEN, "Access denied",
                                "Your role does not have permission for this resource.")))
                .addFilterBefore(correlationIdFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(jwtFilter, CorrelationIdFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(properties.cors().allowedOrigins().split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of(CorrelationIdFilter.REQUEST_ID_HEADER));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private void writeProblem(
            HttpServletRequest req,
            HttpServletResponse res,
            HttpStatus status,
            String title,
            String detail) throws IOException {
        res.setStatus(status.value());
        res.setContentType("application/problem+json");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(req.getRequestURI()));
        problem.setProperty("requestId", MDC.get("requestId"));
        objectMapper.writeValue(res.getOutputStream(), problem);
    }
}
