package care.heron.api.dto.notification;

// A short-lived, single-purpose token the browser EventSource passes as a query
// param (it can't set an Authorization header). Distinct token type — useless
// against any other API even if it surfaces in a log.
public record StreamTokenResponse(String token) {}
