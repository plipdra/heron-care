package care.heron.api.service;

import care.heron.api.document.PatientProfile;
import care.heron.api.document.enums.Sex;
import care.heron.api.exception.ResourceNotFoundException;
import care.heron.api.repository.PatientProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
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

    // Full replace from the patient's profile editor: the form always submits the
    // complete intended state, so each field is set as given — a null (a field the
    // patient cleared) overwrites, rather than silently keeping the old value.
    public PatientProfile updateMine(String userId, UpdatePatientProfileCommand command) {
        PatientProfile profile = getMine(userId);
        profile.setName(command.name());
        profile.setBirthday(command.birthday());
        profile.setSex(command.sex());
        profile.setWeightKg(command.weightKg());
        profile.setHeightCm(command.heightCm());
        profile.setContactNumber(command.contactNumber());
        profile.setConditions(command.conditions());
        profile.setAllergies(command.allergies());
        profile.setMedications(command.medications());
        profile.setNotesForDoctor(command.notesForDoctor());
        return patientProfileRepository.save(profile);
    }

    public record UpdatePatientProfileCommand(
            String name,
            LocalDate birthday,
            Sex sex,
            Double weightKg,
            Double heightCm,
            String contactNumber,
            List<String> conditions,
            List<String> allergies,
            List<String> medications,
            String notesForDoctor) {}
}
