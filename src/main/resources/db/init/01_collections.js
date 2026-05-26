// Collections with $jsonSchema validators.
// Runs once when the mongo container first initialises (Docker entrypoint).
// Validators stop the application from inserting malformed documents even if
// Bean Validation on a DTO is bypassed — defence in depth.

db = db.getSiblingDB("heron");

db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "passwordHash", "role", "status"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
        },
        passwordHash: { bsonType: "string", minLength: 60 },
        role: { enum: ["PATIENT", "DOCTOR"] },
        status: { enum: ["ACTIVE", "INACTIVE"] }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.createCollection("doctor_profiles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "name", "specialization"],
      properties: {
        userId: { bsonType: "string" },
        name: { bsonType: "string", minLength: 1, maxLength: 200 },
        bio: { bsonType: ["string", "null"], maxLength: 2000 },
        specialization: {
          enum: [
            "GENERAL_PRACTICE",
            "INTERNAL_MEDICINE",
            "PEDIATRICS",
            "OB_GYN",
            "CARDIOLOGY",
            "DERMATOLOGY",
            "PSYCHIATRY",
            "NEUROLOGY",
            "ORTHOPEDICS",
            "ENDOCRINOLOGY"
          ]
        },
        profilePicturePath: { bsonType: ["string", "null"] },
        defaultMeetingLink: { bsonType: ["string", "null"] },
        yearsOfExperience: { bsonType: ["int", "null"], minimum: 0, maximum: 70 }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.createCollection("patient_profiles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "name"],
      properties: {
        userId: { bsonType: "string" },
        name: { bsonType: "string", minLength: 1, maxLength: 200 }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

print("[heron] collections created with JSON Schema validators");
