# Architecture

How Heron is put together, and the reasoning behind the choices. For setup and
configuration see the [README](README.md).

## Overview

Heron is a layered Spring Boot monolith with a React single-page app, shipped as
**one deployable artifact**: the built frontend is served by the backend, so there
is a single origin (no CORS) and a single deploy.

```
                    ┌──────────────────────────────────────────┐
   Browser  ──────► │  Spring Boot service (one jar)            │
   (React SPA)      │                                          │
                    │  Controller ─► Service ─► Repository ─────┼──► MongoDB Atlas
                    │   (DTO,        (business    (Spring Data   │
                    │    @Valid,      rules)       Mongo)        │
                    │    @PreAuthorize)                          │
                    │                                          │
                    │  SSE stream  ◄── NotificationService       │
                    └──────────────────────────────────────────┘
        ▲ Cloudflare (grey-cloud DNS) sits in front so the SSE stream isn't buffered.
```

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind + shadcn/ui (Radix), TanStack Query |
| Backend | Spring Boot 3.3 (Java 21), Spring Web / Security / Validation / Data Mongo |
| Database | MongoDB (Atlas in prod) |
| Auth | Spring Security + JWT (HS256), access + refresh tokens |
| Real-time | Server-Sent Events (`SseEmitter`) |
| AI | Spring AI (OpenAI-compatible client → Google Gemini) with a deterministic rules fallback |
| Deploy | Single jar on Render, Cloudflare in front |

## Request lifecycle

Every request flows through the same four layers, each with one job:

1. **Controller** — HTTP + DTOs in/out, `@Valid` bean validation, `@PreAuthorize`
   role gating. No business logic.
2. **Service** — the business rules: slot validation, conflict handling, auth,
   notifications, AI routing. The only layer that mutates domain state.
3. **Repository** — Spring Data Mongo interfaces; queries by derived method names.
4. **Document** — the persisted aggregates (below).

DTOs are deliberately separate from documents so the wire shape can differ from
storage — e.g. a doctor's *public* response omits the email and default meeting
link by **shape**, not by hope, so private fields can't leak by accident.

## Data model

Six collections. Profiles are split from the `users` identity record (1:1 by
`userId`), and a user has at most one `ProfilePicture` (stored separately so list
endpoints never ship picture bytes).

```
            ┌─────────────┐
            │   users     │  id, email (unique), passwordHash, role
            └─────┬───────┘
        userId 1:1│        │1:1 userId
        ┌─────────┘        └──────────┐
        ▼                             ▼
┌──────────────────┐        ┌─────────────────────────────┐
│ patient_profiles │        │ doctor_profiles             │
│ name, birthday,  │        │ name, bio, specialization,  │
│ sex, weightKg,   │        │ yearsOfExperience,          │
│ heightCm,        │        │ prcLicenseNo, ptrNo,        │
│ contactNumber,   │        │ defaultMeetingLink,         │
│ conditions[],    │        │ published,                  │
│ allergies[],     │        │ availability {              │
│ medications[],   │        │   timeZone,                 │
│ notesForDoctor   │        │   weeklySchedule[],         │  ◄─ embedded
└──────────────────┘        │   blockedRanges[] }         │
                            └─────────────────────────────┘
   users.id ─┐  ┌─ users.id
             ▼  ▼
      ┌───────────────────────────────────────────────┐
      │ bookings                                      │
      │ patientUserId, doctorUserId,                  │
      │ startsAt, endsAt, status, concernNote,        │
      │ meetingLink (snapshot), idempotencyKey,       │
      │ rescheduledHistory[], cancelledAt, version,   │
      │ consultationRecord {                          │  ◄─ embedded value object
      │   subjective, objective, assessment, plan,    │
      │   prescription[], finalizedAt }               │
      └───────────────────────────────────────────────┘

┌──────────────────┐        ┌──────────────────────────────┐
│ profile_pictures │        │ notifications                │
│ userId (unique), │        │ recipientUserId, type,       │
│ data, contentType│        │ message, startsAt, readAt    │
└──────────────────┘        └──────────────────────────────┘
```

**Embed vs. reference** is the central data decision:

- **Embed** dependents with no independent lifecycle: a `ConsultationRecord` (SOAP
  notes + prescription) lives *inside* its booking because a note has no life
  outside its consult; likewise `availability` on a doctor, and reschedule
  history on a booking. One read returns the whole picture — no joins.
- **Reference** entities with their own pages and lifecycles: `users`, the two
  profiles, and `bookings` reference each other by `userId`.

`meetingLink` is **denormalised onto the booking at create time** (a snapshot,
like an invoice line item) so a patient's join link stays stable even if the
doctor later changes their default.

## Indexes & correctness invariants

Integrity is enforced at the database, not hoped for in application code:

- **No double-booking** — a *unique partial index* on `(doctorUserId, startsAt)`
  filtered to `status = CONFIRMED`. Two patients racing for the same slot: one
  wins, the other gets a clean conflict. Cancelled bookings don't block the slot.
- **Idempotent booking** — a *unique sparse index* on `(patientUserId,
  idempotencyKey)`, so a retried "Book" request returns the original booking
  instead of creating a duplicate.
- **Lost-update safety** — bookings carry an `@Version` field (optimistic
  locking) so a cancel/complete race can't silently clobber.
- **Unique identity** — unique indexes on `users.email` and each profile's
  `userId`; a non-unique `doctor_profiles.specialization` index backs discovery
  filtering.

## Slots are derived, never stored

There is no slot table. `SlotService` computes available 30-minute slots on the
fly from a doctor's `availability` rules minus existing confirmed bookings, in the
doctor's timezone. The same boundary logic answers "is this booking still inside
the doctor's availability?" — reused when a schedule edit fires notifications, so
**only patients whose slot is actually disrupted are alerted**.

Booking *status* is `CONFIRMED` / `COMPLETED` / `CANCELLED`; everything else is
**derived from time on read** (an "ended, awaiting-notes" visit is a confirmed
booking whose end has passed). Completion is a *clinical act* — the doctor
finalising notes — not a clock event, so there's no background job flipping state.

## Cross-cutting concerns

- **Auth** — Spring Security + stateless JWT (HS256), access + refresh tokens, so
  the API scales horizontally with no session store. The SSE stream uses a
  separate **short-lived stream-token** minted per connection, so the long-lived
  bearer never rides in a URL.
- **Real-time** — `NotificationService` keeps a per-user registry of `SseEmitter`s
  and pushes events live; notifications are also persisted (the panel is the
  system of record, the push is a nicety) and listed newest-first via a
  `(recipientUserId, createdAt)` index. SSE — not WebSocket — because the traffic
  is one-way server→client.
- **AI recommendation** — a strategy that calls the model but **falls back to
  deterministic rules** if it's unavailable, behind a safety contract: a red-flag
  pre-screen first, then a suggested *type of doctor*, never a diagnosis.
- **Validation** — bean validation plus custom validators: phone numbers via
  libphonenumber (PH numbering plan / E.164), a "meaningful text" check, and a
  past-date-within-a-lifespan check for birthdays. The backend is the gate; the
  client mirrors the rules only for instant, located feedback.
- **Error handling** — a global handler returns structured problem responses with
  per-field errors, so the UI can land a message on the exact input that failed.

## Why this shape

- **A monolith, not microservices** — one solo build, one bounded domain; the
  layering gives separation of concerns without the operational cost of services.
- **A document database** — the domain is an aggregate (a booking and its record),
  not a web of joins; Mongo fits the access pattern and Atlas is zero-ops.
- **Custom REST, no BaaS for data** — keeps the business rules (slots, conflicts,
  auth) in owned code that can be explained, not a vendor black box.
- **Guest-first marketplace** — patients browse, search, and get a recommendation
  without an account; sign-in is asked only at the booking commitment, to lower
  the barrier to value. A product decision encoded in the routing, not just the UI.

For what is deliberately out of scope and why, see **Limitations & roadmap** in
the [README](README.md#limitations--roadmap).
