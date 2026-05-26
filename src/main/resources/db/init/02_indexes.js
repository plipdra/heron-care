// Indexes for query performance and uniqueness invariants.
// `spring.data.mongodb.auto-index-creation` is off — indexes are explicit here.

db = db.getSiblingDB("heron");

db.users.createIndex(
  { email: 1 },
  { unique: true, name: "users_email_unique" }
);

db.doctor_profiles.createIndex(
  { userId: 1 },
  { unique: true, name: "doctor_profiles_userId_unique" }
);
db.doctor_profiles.createIndex(
  { specialization: 1 },
  { name: "doctor_profiles_specialization" }
);

db.patient_profiles.createIndex(
  { userId: 1 },
  { unique: true, name: "patient_profiles_userId_unique" }
);

print("[heron] indexes created");
