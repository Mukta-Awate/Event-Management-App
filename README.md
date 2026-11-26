# EventDesk — Event Management App

Full-stack event management app for the assignment brief: organizers create and manage events; attendees discover and register. Role and ownership checks are enforced by the NestJS API, not only hidden in the UI.

**Stack:** React (Vite + TypeScript) · NestJS · PostgreSQL (Docker) · TypeORM · JWT

---

## Prerequisites

- Node.js 20+
- Docker Desktop (with WSL 2 on Windows) — used for PostgreSQL

---

## Setup and run

### 1. Start the database (Docker)

From the project root:

```bash
docker compose up -d
```

This starts PostgreSQL 16 in container `ema-postgres` on port `5432` with:

| Setting | Value (local demo only) |
| --- | --- |
| Database | `event_management` |
| User | `ema` |
| Password | `ema` |

Check it is running:

```bash
docker compose ps
```

Stop later with `docker compose down` (add `-v` only if you want to wipe DB data).

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

API: `http://localhost:3000/api`

On first start with `SEED_ON_START=true`, TypeORM creates the schema and seeds demo users/events.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

---

## Environment variables

Copy from the `.env.example` files. **Do not commit real secrets.** Checked-in examples use local demo placeholders only. `.env` is gitignored.

### Backend (`backend/.env`)

| Variable | Description | Local example |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `DATABASE_HOST` | Postgres host | `localhost` |
| `DATABASE_PORT` | Postgres port | `5432` |
| `DATABASE_USER` | DB user | `ema` |
| `DATABASE_PASSWORD` | DB password | `ema` |
| `DATABASE_NAME` | Database name | `event_management` |
| `JWT_SECRET` | JWT signing secret — change outside local demo | `dev-only-change-me-in-production` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `SEED_ON_START` | Seed demo users/events on boot | `true` |

### Frontend (`frontend/.env`)

| Variable | Description | Local example |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:3000/api` |

---

## Seeded accounts

Created when `SEED_ON_START=true`:

| Email | Password | Role |
| --- | --- | --- |
| `organizer@example.com` | `password123` | organizer |
| `attendee@example.com` | `password123` | attendee |
| `attendee2@example.com` | `password123` | attendee |

Also seeds a published “Product Meetup” (capacity 3) and a draft workshop owned by the organizer.

**Auth shortcut:** self-registration lets a user pick `organizer` or `attendee` for local demo speed. In production you would invite organizers separately, never ship default passwords, keep secrets in a vault, use short-lived tokens (ideally with refresh), and rate-limit auth.

---

## Running tests

```bash
cd backend
npm test
```

Automated coverage includes:

- Duplicate active registration prevention
- Capacity-full rejection
- Rejection for canceled or already-started events
- Organizer ownership checks (cannot manage another organizer’s events or attendee lists)
- Capacity cannot be reduced below active registrations

### Concurrent last-seat verification

With the API running and a published event that has **exactly one place left**:

```bash
cd backend
EVENT_ID=<event-uuid> node scripts/concurrent-register.mjs
```

Expected: one success and one `409 Conflict` — never two successful registrations over capacity.

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

**Rules:**

- Public listing shows only **published**, upcoming events.
- Draft and canceled events are not available for registration.
- Canceling a registration frees a place.
- Organizer routes re-check `event.organizerId === currentUser.id` on the server.

---

## Key decisions, assumptions, and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| React + NestJS + Postgres/TypeORM | Matches the required stack | Two apps to run instead of one monolith |
| Postgres via Docker Compose | Reliable local DB without a manual install | Docker Desktop / WSL required on Windows |
| TypeORM `synchronize: true` | Fast local schema for the assignment | Use migrations in production |
| JWT Bearer auth | Simple, stateless demo auth | No refresh-token rotation |
| Role on JWT + ownership checks on API | Meets “backend must enforce” | Role changes need a new login |
| Pessimistic lock on register | Clear last-seat concurrency story | More row contention under extreme load |
| Self-serve role at signup | Easy testing with seeded + new users | Not production tenancy |
| IANA `timeZone` + UTC `startAt` | Meets time-zone requirement without a heavy calendar UI | `datetime-local` editing is approximate |

**Assumptions:** one Postgres instance; at most one active registration per attendee per event; local demo secrets only; deployment optional and out of scope.

---

## What was completed

- Event create / edit / cancel for organizers (title, description, start, time zone, venue, positive capacity, draft/published/canceled)
- Backend ownership and capacity-floor validation
- Public discovery and event detail with places remaining; loading, empty, and error states
- Attendee register / cancel with duplicate, full, canceled, and started guards; seat release on cancel
- Concurrent last-place handling (row lock + unique index) and verification script
- Organizer dashboard (events, capacity stats, attendee list)
- Attendee dashboard (registrations, cancel, canceled distinguished)
- JWT auth with seeded accounts and documented shortcuts
- Docker Compose Postgres setup
- Automated unit tests for the highest-risk rules
- This README

## What remains unfinished / out of scope

- TypeORM migrations (schema uses `synchronize` for local demo)
- Optional DB-backed e2e / concurrent Jest suite in CI
- Production hardening (refresh tokens, rate limits, managed secrets)
- Deploying the app beyond local run (optional per assignment)

## What I would improve with more time

- Versioned migrations and an explicit seed command
- Short-lived access + refresh tokens; invite-only organizers
- Playwright e2e for the main journey and cross-organizer access denial
- Pagination, search/filter on discovery, better time-zone picker
- Structured logging and rate limiting on auth/register
- Optional Docker images for API and frontend so the full stack runs under Compose

---

## Project layout

```
backend/               NestJS API, TypeORM entities, unit tests
frontend/              React (Vite) SPA
docker-compose.yml     PostgreSQL service
README.md              This file
```
