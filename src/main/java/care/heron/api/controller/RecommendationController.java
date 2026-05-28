package care.heron.api.controller;

import care.heron.api.dto.recommendation.RecommendationRequest;
import care.heron.api.dto.recommendation.RecommendationResponse;
import care.heron.api.service.recommendation.RecommendationQuery;
import care.heron.api.service.recommendation.RecommendationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// PUBLIC — the recommendation is discovery (the marketing surface), so guests
// reach it without an account; auth happens later, at the booking tap. The
// public POST is allow-listed in SecurityConfig.
@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @PostMapping
    public RecommendationResponse recommend(@Valid @RequestBody RecommendationRequest request) {
        return recommendationService.recommend(
                new RecommendationQuery(request.concern(), request.forWhom(), request.duration()));
    }
}
