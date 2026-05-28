package care.heron.api.service.recommendation;

import care.heron.api.document.DoctorProfile;
import care.heron.api.document.enums.Specialization;
import care.heron.api.dto.recommendation.RecommendationResponse;
import care.heron.api.service.DoctorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/*
 * The recommendation defends two things worth testing as behaviour: a red-flag
 * input is short-circuited to a safety notice BEFORE any directory lookup (the
 * app must never imply it triaged an emergency), and the rules strategy always
 * yields a usable, experience-ranked result — matching when it can, widening to
 * General Practice when it can't, never "no match". The real RulesStrategy is
 * used (it's pure logic); only the directory is mocked.
 */
@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    @Mock DoctorService doctorService;
    RecommendationService service;

    @BeforeEach
    void setUp() {
        service = new RecommendationService(doctorService, new RulesStrategy());
    }

    @Test
    void matches_a_concern_to_a_specialty_and_ranks_by_experience() {
        givenDirectory(
                doc("Junior Cardio", Specialization.CARDIOLOGY, 5),
                doc("Senior Cardio", Specialization.CARDIOLOGY, 15),
                doc("Some Derm", Specialization.DERMATOLOGY, 10));

        RecommendationResponse r = service.recommend(
                new RecommendationQuery("chest pain on exertion", null, null));

        assertThat(r.urgent()).isFalse();
        assertThat(r.suggestedSpecializationLabel()).isEqualTo("Cardiology");
        assertThat(r.doctors()).hasSize(2);
        assertThat(r.doctors().get(0).doctor().name()).isEqualTo("Senior Cardio"); // experience-ranked
    }

    @Test
    void routes_a_child_concern_to_pediatrics() {
        givenDirectory(
                doc("Paeds Doc", Specialization.PEDIATRICS, 8),
                doc("GP Doc", Specialization.GENERAL_PRACTICE, 8));

        RecommendationResponse r = service.recommend(
                new RecommendationQuery("fever", "CHILD", null));

        assertThat(r.suggestedSpecializationLabel()).isEqualTo("Pediatrics");
        assertThat(r.doctors())
                .allSatisfy(d -> assertThat(d.doctor().specializationLabel()).isEqualTo("Pediatrics"));
    }

    @Test
    void falls_back_to_general_practice_when_nothing_matches() {
        givenDirectory(
                doc("GP Doc", Specialization.GENERAL_PRACTICE, 8),
                doc("Cardio Doc", Specialization.CARDIOLOGY, 8));

        RecommendationResponse r = service.recommend(
                new RecommendationQuery("i just feel a bit unwell", null, null));

        assertThat(r.suggestedSpecializationLabel()).isEqualTo("General Practice");
        assertThat(r.doctors()).isNotEmpty();
    }

    @Test
    void short_circuits_red_flag_input_without_touching_the_directory() {
        RecommendationResponse r = service.recommend(
                new RecommendationQuery("i want to kill myself", null, null));

        assertThat(r.urgent()).isTrue();
        assertThat(r.notice()).isNotBlank();
        assertThat(r.doctors()).isEmpty();
        verify(doctorService, never()).listPublic(any(), any(), any());
    }

    private void givenDirectory(DoctorProfile... docs) {
        given(doctorService.listPublic(any(), any(), any(Pageable.class)))
                .willReturn(new PageImpl<>(List.of(docs)));
    }

    private DoctorProfile doc(String name, Specialization specialization, int years) {
        return DoctorProfile.builder()
                .id(name)
                .userId(name + "-uid")
                .name(name)
                .specialization(specialization)
                .yearsOfExperience(years)
                .build();
    }
}
