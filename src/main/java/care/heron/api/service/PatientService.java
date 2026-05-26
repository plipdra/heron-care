package care.heron.api.service;

import care.heron.api.document.PatientProfile;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.PatientProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientProfileRepository patientProfileRepository;

    public PatientProfile getMine(String userId) {
        return patientProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient profile for user " + userId + " not found"));
    }

    // Patch-style: non-null fields overwrite, nulls leave existing values
    // alone. Patients fill the form progressively across multiple saves.
    public PatientProfile updateMine(String userId, UpdatePatientProfileCommand command) {
        PatientProfile profile = getMine(userId);
        if (command.name() != null) profile.setName(command.name());
        if (command.birthday() != null) profile.setBirthday(command.birthday());
        if (command.weightKg() != null) profile.setWeightKg(command.weightKg());
        if (command.heightCm() != null) profile.setHeightCm(command.heightCm());
        if (command.contactNumber() != null) profile.setContactNumber(command.contactNumber());
        if (command.medicalHistory() != null) profile.setMedicalHistory(command.medicalHistory());
        return patientProfileRepository.save(profile);
    }

    public record UpdatePatientProfileCommand(
            String name,
            LocalDate birthday,
            Double weightKg,
            Double heightCm,
            String contactNumber,
            String medicalHistory) {}
}
