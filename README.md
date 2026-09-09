# Evently — Event Planning App

A full-stack event planning app: create, browse, and RSVP to events, with tag-based
categorization, public/private visibility, and JWT-based auth. Built as a take-home
assessment; see `docs/api-contract.md` and `docs/database-schema.md` for full API and
schema reference.

**Tech stack:** React + TypeScript (frontend), Express + TypeScript (backend), MySQL via
Knex.js (no ORM), Tailwind CSS.

## Implemented features

### Required

- User signup and login with JWT authentication
- Protected authenticated routes (frontend route guards, backend `requireAuth` middleware)
- Create, view, edit, and delete events
- Creator-only authorization for edit/delete (see [Engineering decisions](#engineering-decisions))
- Upcoming and past event listings
- Public/private event visibility
- Multiple tags per event
- Filtering by search text, tag, and visibility; sorting (including by RSVP popularity)
- Server-side pagination
- Frontend and backend validation (see [Engineering decisions](#engineering-decisions))
- Loading, empty, and error states throughout the events UI

### Additional

- RSVP responses: `going`, `maybe`, and `not_going` (displayed in the UI as "Can't go")
- Refresh-token rotation with reuse detection (see [Engineering decisions](#engineering-decisions))
- Email verification (sends via Resend when configured; logs the link to the console in dev)
- Two-factor authentication (TOTP) — see the [Assumptions](#assumptions) note on its limitation
- Swagger/OpenAPI docs generated from the running server at `/api/docs`

## Setup instructions

### Prerequisites

- Node.js 18+ and npm
- MySQL 8, either via Docker Compose (below) or an existing local instance

### 1. Database

Using the included `docker-compose.yml` (recommended):

```bash
cp backend/.env.example backend/.env
# edit backend/.env if you want non-default credentials/ports
docker compose --env-file backend/.env up -d
```

Or point `backend/.env`'s `DB_*` values at a MySQL instance you already have running —
the app doesn't care which.

### 2. Backend

```bash
cd backend
npm install
npm run migrate:latest
npm run seed:run   # optional — seeds two demo accounts, see below
npm run dev
```

Runs on `http://localhost:4000`. Interactive API docs (Swagger UI) at
`http://localhost:4000/api/docs`.

`seed:run` seeds two accounts with sample public/private events and an RSVP (resets on
every run — don't use it on data you want to keep):

| | Email | Password |
|---|---|---|
| Owner | `demo@evently.dev` | `Demo1234!` |
| Viewer | `demo2@evently.dev` | `Demo1234!` |

Log in as either to browse/filter/create/edit/RSVP; log in as the other to confirm private
events and edit/delete stay creator-only. Seed data is optional — `/register` works too.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### 4. (Optional) Git hooks

```bash
npm install   # at the repo root — sets up a pre-commit hook that typechecks both apps
```

### Other useful scripts

| Location | Script | Does |
|---|---|---|
| `backend/` | `npm run typecheck` | `tsc --noEmit` |
| `backend/` | `npm run build` / `npm start` | compile to `dist/`, then run it |
| `backend/` | `npm run migrate:rollback` | undo the last migration batch |
| `backend/` | `npm run migrate:make <name>` | scaffold a new migration |
| `backend/` | `npm run seed:run` | reset the two demo accounts + their events (see Setup step 2) |
| `frontend/` | `npm run typecheck` | `tsc --noEmit` |
| `frontend/` | `npm run build` / `npm run preview` | production build, then serve it locally |

## Engineering decisions

Required-feature decisions first; the two optional security features (refresh-token
rotation, 2FA) at the end.

### Knex, not an ORM

- Alternative: an ORM (Prisma, Sequelize) — trades away SQL visibility for convenience.
- `GET /api/events` needs dynamic `WHERE`/`ORDER BY` composition (search, tag, visibility,
  status, sort) plus a subquery for popularity sort — awkward through most ORM abstractions.
- **Decision:** Knex query builders throughout, plain `.ts` migrations, transactions via
  `db.transaction()`.

### Routes call services directly — no controller or data-access layer

- Alternative: routes → controllers → services → a repository layer, each with one job.
- **Decision:** each module's `*.routes.ts` handles the HTTP concerns and calls straight
  into its `*.service.ts`, which owns both the business logic and the Knex queries
  themselves — e.g. `createEventRecord` opens a transaction and runs its own inserts.

### React Query for server state

- Alternative: hand-rolled loading/error/cache state via `useState`/`useEffect`, or a
  global store (Redux, Zustand) with a caching layer written from scratch.
- **Decision:** React Query for every API read and write — queries for lists/details,
  mutations for create/update/delete/RSVP — with `invalidateQueries` re-fetching after a
  mutation succeeds (deleting an event invalidates the `['events']` list).

### React Hook Form + Zod for forms

- Alternative: plain controlled `useState` per field, or a heavier form library with its
  own validation DSL.
- **Decision:** React Hook Form owns field/submission state; the same Zod schemas validate
  on the frontend for immediate feedback, then again on the backend (the frontend check is
  only a UX convenience — an API client could skip it entirely).

### Existence-hiding for private events

- Alternative: a uniform `403` for anyone not allowed to see or edit a resource.
- A `403` on a private event would confirm it exists to someone who shouldn't know.
- **Decision:** a non-owner gets `404` (not `403`) on a private event's `GET`/`PUT`/`DELETE`;
  editing or deleting someone else's *public* event gets a plain `403`.

**Also:**

- Tags are freeform, resolved-or-created inline in the same transaction as the event — no
  standalone "create tag" endpoint.
- Standard security middleware: `helmet()`, a CORS allowlist, `express-rate-limit`, bcrypt,
  structured `winston` logging.
- API docs generated live via `swagger-ui-express`, not hand-maintained.
- No shared monorepo tooling — `frontend/`/`backend/` are independent npm projects.

### Access token + refresh-token rotation, not one long-lived token *(optional feature)*

- Alternative: a single long-lived JWT trusted statelessly — can't be revoked before it
  expires, so "logout" would be fake.
- **Decision:** a 15-minute access token (stateless, no DB hit per request) paired with an
  opaque, DB-backed refresh token in an httpOnly cookie (`refresh_tokens` table: hash,
  device, IP, expiry, revocation state). Every `/auth/refresh` call **rotates** it and links
  the old row to the new one via `replaced_by_id`. A token whose `replaced_by_id` is already
  set being presented again can only mean it leaked — every session for that user is
  revoked immediately.
- **Along the way:** found a real race — two concurrent refresh calls presenting the same
  token could each mint their own replacement before either committed. Fixed by wrapping
  the read-check-insert-update sequence in one transaction with `SELECT ... FOR UPDATE`,
  the same row-locking pattern used to consume an email-verification token.

### 2FA via a short-lived pre-auth token *(optional feature)*

- Alternative: a second full login step — check the TOTP code, then rerun the whole login
  flow.
- **Decision:** a password check on a 2FA-enabled account issues a short-lived (5 min),
  narrowly-typed `pre_auth` JWT, not real tokens. `requireAuth` rejects it outright (only
  `type: 'access'` passes), so it's only usable by `POST /auth/2fa/verify`, which issues
  the real access token and refresh session once the TOTP code checks out.
- **Limitation:** no backup/recovery codes (see [Assumptions](#assumptions)) — losing the
  authenticator device locks the account out, by design for this version.

## Assumptions

### Business Assumptions

* **RSVP has no explicit "not answered" status.** A missing RSVP row means the user has not responded. Clearing an RSVP deletes the row, keeping "unanswered" distinct from `not_going`.
* **Popularity is based only on `going` RSVPs.** `maybe` responses do not contribute because they do not represent confirmed attendance.
* **Tag names are case-insensitive.** "Design" and "design" resolve to the same tag rather than creating duplicate tags.
* **Email verification is a soft gate.** Unverified users can still log in and use the application.
* **Any authenticated user can RSVP to any event they can view**, including their own. There is no invitation or attendee-approval system.
* **New events default to `public` visibility** when no visibility is specified.
* **Email addresses are case-insensitive.** `Ada@Example.com` and `ada@example.com` are treated as the same account for registration and login.
* **New events must start at least 24 hours from creation time**, not just "in the future." This only applies when `startsAt` is being set, so editing other fields on an event whose start time has since drifted under 24 hours away still works.
* **`endsAt` must be at least 15 minutes after `startsAt`.**
* **The event API never exposes who created it beyond a `creatorId`.** No creator name, email, or avatar is returned to viewers.
* **Events have no photo upload.** Each event's cover is an auto-generated gradient based on its title and ID, not a user-uploaded image.

### Data Model Assumptions

* **Users → Events:** one-to-many. A user can create multiple events, while each event has exactly one creator. There is no co-ownership or shared editing.
* **Events ↔ Tags:** many-to-many through `event_tags`. An event can have multiple tags, and a tag can belong to multiple events.
* **Users ↔ Events (RSVP):** many-to-many with at most one RSVP per user/event pair. The composite primary key (`event_id`, `user_id`) enforces this.
* **Users → Refresh Tokens:** one-to-many. A user can have multiple sessions/devices, with each refresh-token record belonging to one user.
* **Users → Email Verifications:** one-to-many in the schema, but only one active verification record is maintained per user by application logic within a transaction rather than a database `UNIQUE` constraint.
* **Users → TOTP Secret:** one-to-one when present. The nullable `totp_secret` column on `users` represents at most one 2FA secret per user.

### Deliberate Limitations

* **2FA has no backup/recovery codes.** Losing the authenticator device can make the account inaccessible in this version.
* **No automated test suite is currently included.** API behavior was manually verified using Postman and Swagger UI.
