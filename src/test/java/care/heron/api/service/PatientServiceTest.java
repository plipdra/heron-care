package care.heron.api.service;

import care.heron.api.document.PatientProfile;
import care.heron.api.document.enums.Sex;
import care.heron.api.repository.PatientProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

/*
 * The profile editor is a FULL replace, not a patch: the form submits the whole
 * intended state every save, so a field the patient cleared must actually be
 * cleared (null overwrites) — not silently kept from the previous value.
 */
@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock PatientProfileRepository patientProfileRepository;
    PatientService service;

    static final String USER_ID = "patient-001";

    @BeforeEach
    void setUp() {
        service = new PatientService(patientProfileRepository);
    }

    @Test
    void updateMine_clears_a_field_the_patient_emptied() {
        given(patientProfileRepository.findByUserId(USER_ID))
                .willReturn(Optional.of(PatientProfile.builder()
                        .userId(USER_ID)
                        .name("Demo Patient")
                        .contactNumber("+63 917 555 1234")
                        .build()));
        given(patientProfileRepository.save(any(PatientProfile.class)))
                .willAnswer(inv -> inv.getArgument(0));

        // The form is submitted with the contact number cleared (null).
        PatientProfile result = service.updateMine(USER_ID,
                new PatientService.UpdatePatientProfileCommand(
                        "Demo Patient", null, null, null, null, null,
                        null, null, null, null));

        assertThat(result.getContactNumber()).isNull(); // cleared, not retained
        assertThat(result.getName()).isEqualTo("Demo Patient");
    }

    @Test
    void updateMine_saves_the_submitted_values() {
        given(patientProfileRepository.findByUserId(USER_ID))
                .willReturn(Optional.of(PatientProfile.builder().userId(USER_ID).build()));
        given(patientProfileRepository.save(any(PatientProfile.class)))
                .willAnswer(inv -> inv.getArgument(0));

        PatientProfile result = service.updateMine(USER_ID,
                new PatientService.UpdatePatientProfileCommand(
                        "Ana", LocalDate.of(1990, 1, 1), Sex.FEMALE, 60.0, 165.0,
                        "+63 917 555 1234",
                        List.of("Mild persistent asthma"),
                        List.of("Penicillin"),
                        List.of("Salbutamol inhaler PRN"),
                        "Prefers afternoon consults."));

        assertThat(result.getName()).isEqualTo("Ana");
        assertThat(result.getContactNumber()).isEqualTo("+63 917 555 1234");
        assertThat(result.getWeightKg()).isEqualTo(60.0);
        assertThat(result.getSex()).isEqualTo(Sex.FEMALE);
        assertThat(result.getConditions()).containsExactly("Mild persistent asthma");
        assertThat(result.getAllergies()).containsExactly("Penicillin");
        assertThat(result.getMedications()).containsExactly("Salbutamol inhaler PRN");
        assertThat(result.getNotesForDoctor()).isEqualTo("Prefers afternoon consults.");
    }
}
