# EventDesk — Event Management App

A small full-stack event management product: organizers create and manage events; attendees discover and register. Role and ownership checks are enforced by the NestJS API, not only hidden in the UI.

**Stack:** React (Vite + TypeScript) · NestJS · PostgreSQL · TypeORM · JWT

---

## Setup and run

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (via Docker Compose below, or any local/remote Postgres instance)

### 1. Database

**With Docker:**

```bash
docker compose up -d
```

This starts Postgres on port `5432` with database `event_management`, user `ema`, password `ema` (local demo values only).

**Without Docker:** create an equivalent database/user, then point `backend/.env` at it.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

API base URL: `http://localhost:3000/api`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App URL: `http://localhost:5173`

---

## Environment variables

Copy from the `.env.example` files. **Do not commit real secrets.** The checked-in examples use local demo placeholders only.

### Backend (`backend/.env`)

| Variable | Description | Example (local only) |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `DATABASE_HOST` | Postgres host | `localhost` |
| `DATABASE_PORT` | Postgres port | `5432` |
| `DATABASE_USER` | DB user | `ema` |
| `DATABASE_PASSWORD` | DB password | `ema` |
| `DATABASE_NAME` | Database name | `event_management` |
| `JWT_SECRET` | JWT signing secret — **replace for any shared/deployed environment** | `dev-only-change-me-in-production` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `SEED_ON_START` | Seed demo users/events on boot (`true` / `false`) | `true` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:3000/api` |

---

## Seeded accounts

Created automatically when `SEED_ON_START=true` (default for local demo):

| Email | Password | Role |
| --- | --- | --- |
| `organizer@example.com` | `password123` | organizer |
| `attendee@example.com` | `password123` | attendee |
| `attendee2@example.com` | `password123` | attendee |

Also seeds a published “Product Meetup” (capacity 3) and a draft workshop owned by the organizer.

**Auth shortcut:** self-registration lets a user pick `organizer` or `attendee`. That is intentional for a local assignment demo. In production you would invite organizers separately, never ship default passwords, store secrets in a vault, use short-lived access tokens (and preferably refresh tokens), and rate-limit auth endpoints.

---

## Running tests

```bash
cd backend
npm test
```

These unit tests exercise the core assignment risks:

- Duplicate active registration for the same event/attendee
- Rejection when the event is full
- Rejection for canceled or already-started events
- Organizer ownership checks (cannot manage another organizer’s event or attendee list)
- Capacity cannot be reduced below the number of active registrations

### Concurrent last-seat check

An automated Jest race against a live DB is environment-dependent. Use the script once the API is running against Postgres and you have a published event with **exactly one place left** (create a capacity-`1` event, or fill the seeded meetup until one seat remains):

```bash
cd backend
EVENT_ID=<event-uuid> node scripts/concurrent-register.mjs
```

Expected outcome: one success and one `409 Conflict` — never two successful registrations over capacity.

Server-side protection:

1. Transaction + `SELECT … FOR UPDATE` on the event row
2. Count of active registrations vs capacity before insert
3. Partial unique index on `(eventId, attendeeId)` where `status = 'active'`

---

## Data model

```
User
  id, email, passwordHash, name, role (organizer | attendee), createdAt

Event
  id, title, description, startAt (timestamptz), timeZone (IANA),
  venue, capacity, status (draft | published | canceled),
  organizerId → User, createdAt, updatedAt

Registration
  id, eventId → Event, attendeeId → User,
  status (active | canceled), registeredAt, canceledAt
```

**Rules encoded in the model/API:**

- Public discovery lists only **published** events with `startAt` in the future.
- Draft and canceled events are not offered for registration.
- Canceling a registration sets status to `canceled`, which frees capacity for someone else.
- Organizer-only routes re-check `event.organizerId === currentUser.id` on the server.

---

## Key decisions, assumptions, and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| Separate `frontend/` and `backend/` | Clear Nest boundary for graders; matches requested stack (React + Nest) | Slightly more setup than a Next.js monolith |
| TypeORM + `synchronize: true` | Fast local schema bootstrap for the assignment | Not safe for production; migrations would replace this |
| JWT in `Authorization: Bearer` | Simple, stateless auth for a demo | No refresh rotation; logout is client-side token discard |
| Role claim on JWT + server ownership checks | UI hiding is not enough for the rubric | Token role could drift if roles changed without re-login (acceptable here) |
| Pessimistic lock on event row for register | Makes the last-seat race deterministic and easy to explain | Slightly more contention under heavy load than sharded counters |
| Self-serve role at registration | Speeds seeding and manual testing | Would not ship as multi-tenant production auth |
| IANA `timeZone` string + UTC `startAt` | Meets “include the event’s time zone” without a heavy calendar library | Browser `datetime-local` editing is approximate; production would use a proper TZ picker |

**Assumptions:** single Postgres instance; one registration “active” at a time per attendee per event; demo secrets are fine on localhost only; deployment is out of scope.

---

## What was completed

- Organizer create / edit / cancel events (title, description, start, time zone, venue, positive capacity, draft/published/canceled)
- Backend ownership enforcement and capacity-floor validation
- Public listing and event detail with places remaining; loading, empty, and error states
- Attendee register and cancel; duplicate, full, canceled, and started guards; seat release on cancel
- Concurrent last-place handling (row lock + unique index) and verification script
- Organizer dashboard (events, capacity/registration stats, attendee list)
- Attendee dashboard (upcoming registrations, cancel, canceled distinguished)
- JWT auth with seeded accounts and documented shortcuts
- Automated unit tests for the highest-risk rules
- This README (setup, env, seeds, tests, model, trade-offs, status)

## What remains unfinished

- Live demo recording / walkthrough video (needs a running Postgres on the submitter’s machine)
- Database migrations (schema currently uses TypeORM synchronize)
- Optional DB-backed e2e / concurrent Jest suite wired to CI
- Git remote / packaged archive packaging (source is present in the project folder)

## What I would improve with more time

- Replace synchronize with versioned migrations and a proper seed command
- Short-lived access tokens + refresh tokens; organizer invite flow instead of self-serve roles
- Playwright end-to-end covering the main happy path and a forbidden cross-organizer attendee fetch
- Pagination, search/filter on discovery, and a better time-zone UX
- Structured logging, request IDs, and rate limiting on auth/register
- Production deployment (containerized API + managed Postgres) and a recorded demo of the capacity constraint

### Suggested live walkthrough (for a demo video)

1. Sign in as `organizer@example.com` → create and publish a capacity-`1` event.
2. Sign in as `attendee@example.com` → register successfully.
3. Sign in as `attendee2@example.com` → see “full” / conflict error.
4. As organizer, open the attendee list; show another organizer cannot access it.
5. Cancel the first registration → second attendee can register.
6. Optionally run `concurrent-register.mjs` against a last-seat event.

---

## Project layout

```
backend/               NestJS API, TypeORM entities, unit tests
frontend/              React (Vite) SPA
docker-compose.yml     Local Postgres
README.md              This file
```
