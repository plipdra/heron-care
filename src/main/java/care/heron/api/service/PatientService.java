package care.heron.api.service;

import care.heron.api.document.PatientProfile;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.PatientProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientProfileRepository patientProfileRepository;

    public PatientProfile getMine(String userId) {
        return patientProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient profile for user " + userId + " not found"));
    }

    public Optional<PatientProfile> findByUserId(String userId) {
        return patientProfileRepository.findByUserId(userId);
    }

    // Display names only, keyed by userId — for the doctor's appointment list.
    // Deliberately returns ONLY names: medical history and other PII never enter
    // this map, so they can't leak into a list response.
    public Map<String, String> namesByUserIds(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        return patientProfileRepository.findByUserIdIn(userIds).stream()
                .filter(p -> p.getName() != null)
                .collect(Collectors.toMap(PatientProfile::getUserId, PatientProfile::getName));
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
