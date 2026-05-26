package care.heron.api.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

// Reads a Bearer JWT from the Authorization header and populates SecurityContext.
// Intentionally silent on missing/invalid tokens — the marketplace-auth flow needs
// guests to reach permit-all routes without a 401. Protected routes 401 via
// SecurityConfig's authenticationEntryPoint when no Authentication is set.
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length());
            jwtService.parse(token).ifPresent(jws -> {
                Claims claims = jws.getPayload();
                if (jwtService.isAccessToken(claims)) {
                    authenticate(request, claims);
                }
            });
        }
        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, Claims claims) {
        String userId = claims.getSubject();
        String role = claims.get("role", String.class);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                userId,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
