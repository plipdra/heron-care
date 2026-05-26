# Heron Care

> Heron Care is a telehealth platform built on the posture its name describes: stillness, watchfulness, precision. From the first symptom search to the consultation that follows, Heron subtracts anxiety from healthcare instead of adding to it.
>
> **Care, watched closely.**

## Quickstart

Requires Docker + Docker Compose v2.

```bash
cp .env.example .env
# Edit .env — generate JWT_SECRET with:  openssl rand -base64 48
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

## Design principles

These three rules break every UI tie:

1. **Calm beats clever.** When two UI patterns work, pick the one that adds less noise.
2. **Specificity beats generality.** Error messages, empty states, status copy — always concrete, never generic.
3. **Stillness beats motion.** Animations only where they communicate state change.

## API overview

Endpoints documented at `/swagger-ui.html` when the backend is running. Detailed list lands by Day 4.

## Demo accounts

Seeded by the Mongo init scripts. Password for all: `Demo123!`.

| Role | Email |
|---|---|
| Patient | patient.demo@heron.care |
| Doctor — Cardiology | dr.reyes@heron.care |
| Doctor — Cardiology | dr.tan@heron.care |
| Doctor — Dermatology | dr.santos@heron.care |
| Doctor — Pediatrics | dr.lim@heron.care |
| Doctor — Internal Medicine | dr.cruz@heron.care |
| Doctor — Psychiatry | dr.garcia@heron.care |

## Architecture overview

Layered Spring monolith:

```
HTTP → Controller (DTO) → Service (business logic) → Repository (MongoRepository)
```

**Mongo embed-vs-reference policy:** embed dependents with no independent lifecycle (prescription line items, contact sub-doc, medical-history sub-doc); reference entities with their own pages and lifecycles (Patient, Doctor, Appointment).

## Known limitations

_To be expanded as features land._ Day 1 covers scaffolding, auth, and doctor discovery — booking, AI recommendation, SSE notifications, and clinical records arrive across Days 2–3.

## Future work

- **Refresh token revocation list** at full rotation cadence (Day 2 ships a basic revocation collection; full rotation is post-MVP).
- **Per-appointment custom meeting links** (currently doctor-default only — single `defaultMeetingLink` on doctor profile).
- **PRC license validation for doctor registration** (currently self-serve immediate per spec literal — production needs PRC verification before doctors go live).
- **Configurable slot duration per doctor** (currently fixed 30 min).
- **Cancellation cutoff + no-show fee policy** (currently free cancellation until appointment start).
- **HttpOnly cookie token storage** (currently localStorage — XSS-readable).
- **Column-level PII encryption** for clinical notes with envelope encryption.
- **Rate limiting** per user, stricter on auth endpoints.
- **Background reminder jobs** via Spring `@Scheduled` and later a queue.
- **Append-only audit log** for clinical record access (compliance).
- **Google Calendar API integration** for auto-generated Meet links.

## Decisions log

_Curated by Day 4 — the 5–10 architecture decisions the pair-programming session is most likely to probe._

## License

MIT — see [LICENSE](LICENSE).
