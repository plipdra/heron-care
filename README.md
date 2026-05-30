# Heron Care

> Heron Care is a telehealth platform built on the posture its name describes: stillness, watchfulness, precision. From the first symptom search to the consultation that follows, Heron subtracts anxiety from healthcare instead of adding to it.
>
> **Care, watched closely.**

## Why Heron

Most telehealth apps are either feature-stuffed booking tools or "AI doctor"
chatbots that overreach. Heron's thesis is **anxiety-subtraction** — a sick person
is already stressed, so every decision removes noise and earns trust:

- **Calm, trust-first UX.** Three rules break every tie: calm beats clever,
  specificity beats generality, stillness beats motion.
- **AI that routes, never diagnoses.** The symptom router suggests a *type of
  doctor* with a red-flag pre-screen and a deterministic rules fallback —
  safety-bounded, never a diagnosis.
- **Honesty as a feature.** Patient-reported vitals are flagged, prescriptions
  note generic dispensing, and an "ended" visit tells the patient their summary is
  being finalised — Heron never pretends to be more than it is.
- **Guest-first marketplace.** Explore, search, and get a recommendation with no
  signup wall; auth is asked only at the booking commitment.
- **Calm real-time.** An SSE bell that informs without nagging, and schedule-change
  alerts that reach *only* the patients actually affected.

The journey is built to compound trust into retention. Patients go from an anxious
"what's wrong?" to the right specialist, keepable visit summaries, and a
medical-record history that's theirs; doctors get a dashboard that shows the day's
shape at a glance, with patient context at the point of care. In healthcare, trust
— not gamification — is the retention lever.

## Quickstart

Requires Docker + Docker Compose v2.

1. Create a `.env` file in the project root with the keys listed in [Configuration](#configuration).
2. Run:

```bash
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8080>
- Swagger UI: <http://localhost:8080/swagger-ui.html>

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix-based) |
| Server state | TanStack Query |
| Backend | Spring Boot 3.3 (Java 21) |
| Database | MongoDB 7 (Spring Data Mongo) |
| Auth | Spring Security + JWT (HS256) |
| Real-time | Server-Sent Events (Spring `SseEmitter`) |
| AI recommendation | Spring AI (OpenAI starter → Google Gemini compat endpoint) |
| Deploy | Docker Compose (dev) / Render Blueprint (prod) |

## Configuration

The application reads its configuration from environment variables. Create a `.env` file in the project root for local Docker Compose runs; in production the same keys come from the platform's secret manager (Render's environment settings), never from a committed file.

| Variable | Purpose |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Mongo root username — local dev only (production uses Mongo Atlas) |
| `MONGO_INITDB_ROOT_PASSWORD` | Mongo root password — local dev only |
| `MONGO_URI` | Mongo connection string. Local: `mongodb://<user>:<pass>@mongo:27017/heron?authSource=admin`. Production: Atlas cluster connection string. |
| `JWT_SECRET` | Symmetric signing key for JWT access + refresh tokens. **Generate with `openssl rand -base64 48`.** Must decode to at least 256 bits. |
| `JWT_ACCESS_TTL_MIN` | Access token lifetime in minutes. Default: `15`. |
| `JWT_REFRESH_TTL_DAYS` | Refresh token lifetime in days. Default: `7`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins. Local: `http://localhost:5173`. |
| `GEMINI_API_KEY` | Google Gemini API key for AI recommendation (Spring AI via OpenAI-compatible endpoint). Free tier at `aistudio.google.com`. |
| `VITE_API_BASE_URL` | Frontend build-time backend base URL. Local: `http://localhost:8080`. |
| `SPRING_PROFILES_ACTIVE` | Spring profile. Default: `prod`. Use `dev` for verbose logging. |

## Design principles

These three rules break every UI tie:

1. **Calm beats clever.** When two UI patterns work, pick the one that adds less noise.
2. **Specificity beats generality.** Error messages, empty states, status copy — always concrete, never generic.
3. **Stillness beats motion.** Animations only where they communicate state change.

## API overview

Endpoints are documented at `/swagger-ui.html` (OpenAPI) when the backend is running.

## Demo accounts

The seed creates demo patients and doctors across every specialty — for example
`patient.demo@heron.care` (patient) and `dr.cruz@heron.care` (doctor, Internal
Medicine). Login credentials for the live demo are shared privately with the
challenge submission rather than committed here.

## Architecture

A layered Spring Boot monolith behind a single deployable artifact:

```
HTTP → Controller (DTO in/out) → Service (business rules) → Repository (Spring Data Mongo)
```

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the data model, indexes, and the
full reasoning. The key decisions, in short:

- **Document database (MongoDB).** The core domain is an aggregate, not a web of
  joins: a booking *embeds* its consultation record (SOAP notes + prescription)
  and its reschedule history, because a note has no life outside its consult. One
  read returns the whole picture. The embed-vs-reference rule is consistent —
  embed dependents with no independent lifecycle (prescription items, the contact
  and medical-history sub-docs); reference entities with their own pages (Patient,
  Doctor, Booking).
- **Conflict safety at the database.** Double-booking is prevented by a unique
  partial index on `(doctor, start time)` restricted to confirmed bookings —
  correctness enforced by Mongo, not hopeful application code.
- **Stateless JWT auth.** No server session store, so the API scales horizontally.
  The real-time stream uses a separate short-lived token, so the long-lived
  credential never rides in a URL.
- **Server-Sent Events for real-time.** Notifications are one-way (server →
  client), so SSE is the right-sized tool — plain HTTP with automatic reconnect,
  no WebSocket machinery.
- **AI as an enhancement, not a dependency.** The symptom router calls a model but
  falls back to deterministic rules if it is unavailable, behind a safety
  contract: it suggests a *type of doctor*, never a diagnosis, after a red-flag
  pre-screen.
- **Single-service deploy.** The built frontend is served by the backend as one
  artifact on one origin — no CORS, one deploy — the simplest shape that is
  correct for a focused MVP.
- **Guest-first marketplace.** Patients browse, search, and get a recommendation
  without an account; sign-in is asked only at the booking commitment, to lower
  the barrier to value.

## Limitations & roadmap

Heron is a focused MVP: it goes deep on the booking → consultation → records core
and deliberately scopes out adjacent surface area. What's left out, and why:

**Product / realism**

- **No pricing or payments.** Pricing is a business-model decision, and a real
  gateway is PCI scope and refund logic that shows plumbing over product sense —
  and handling money in a prototype is a liability. Booking already models the
  commitment, so payment slots cleanly into the confirm step later.
- **No ratings or reviews.** Reviews need real volume to mean anything; seeded
  stars would mislead in a clinical context. A post-consult rating tied to
  completed visits is the honest version.
- **No insurance / pharmacy / lab integrations.** Each is a partner integration,
  not core to "can a doctor be booked, seen, and prescribe." The prescription is a
  real document the patient can take anywhere.
- **English only; in-app notifications only.** Localization and SMS/email delivery
  are additive once the core is proven.

**Technical / compliance**

- **Video is an external meeting link.** A custom video stack isn't required for
  the consult; the join link is gated to live, confirmed slots so a static room
  never leaks.
- **Completion is a clinical act, not a clock event.** No job auto-marks a visit
  complete; "ended" is derived from time, and the doctor completes it by
  finalizing notes.
- **Credentials are format-checked, not verified.** PRC/PTR numbers and contact
  numbers are validated for shape (libphonenumber for PH numbers), not ownership;
  real verification is an admin workflow.
- **Single shared database for the demo, localStorage tokens, no 2FA / audit
  log.** Deliberate conveniences for a solo build; the production path is separate
  environments, HttpOnly cookies, TOTP 2FA, and an append-only access log under
  the Data Privacy Act.

Each of these is a clean insertion point, not a rewrite.

## License

MIT — see [LICENSE](LICENSE).
