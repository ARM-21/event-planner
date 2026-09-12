# Evently — Event Planning App

Evently is a full stack event planning app. You can create events, browse what is coming up or
already past, tag and filter them, and RSVP. Events can be public or private and the auth is JWT
based. Built as a take-home assessment.

The frontend is React with TypeScript and Tailwind. The backend is Express with TypeScript on
MySQL, using Knex as the query builder instead of an ORM. The full API and schema reference are in
`docs/api-contract.md` and `docs/database-schema.md`, and the bonus SQL questions are answered in
`bonus-question/`, one file per question.

## Implemented features

### Required

- User signup and login with JWT authentication
- Protected routes on both sides, route guards on the frontend and `requireAuth` on the backend
- Create, view, edit, and delete events
- Only the creator can edit or delete their own events
- Upcoming and past event listings
- Public/private event visibility
- Multiple tags per event
- Filtering by search text, tag, and visibility; sorting by date, popularity, or creation time
- Server-side pagination
- Validation on the frontend and again on the backend
- Loading, empty, and error states throughout the events UI

### Additional

- RSVP responses: `going`, `maybe`, and `not_going` (shown in the UI as "Can't go")
- Refresh-token rotation with reuse detection
- Email verification, sends through Resend when configured and logs the link to the console in dev
- Two-factor authentication over TOTP
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

Or point `backend/.env`'s `DB_*` values at a MySQL instance you already have running. The app does
not care which one it is.

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

`seed:run` seeds two accounts with sample public and private events and an RSVP. It resets these
on every run, so do not use it on data you want to keep.

| | Email | Password |
|---|---|---|
| Owner | `demo@evently.dev` | `Demo1234!` |
| Viewer | `demo2@evently.dev` | `Demo1234!` |

Log in as either to browse/filter/create/edit/RSVP; log in as the other to confirm private
events and edit/delete stay creator-only. Seed data is optional, `/register` works too.

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

### Rotating refresh tokens instead of one long lived JWT

A single long lived JWT would have been simpler, but then logout does not really log anyone out. A
stateless token stays valid until it expires and nothing can revoke it in between.

So I used a 15 minute access token which is still verified statelessly with no database hit per
request, together with a 30 day refresh token which is just an opaque random string kept in an
httpOnly cookie. The actual state sits in a `refresh_tokens` row with the hash, device label, IP and
revocation state. Every call to `/auth/refresh` rotates the token and points the old row to its
replacement using `replaced_by_id`.

That `replaced_by_id` column is also what makes reuse detection possible. If a token that was
already rotated past shows up again then it must have leaked, so at that point every session of that
user is revoked and not only the one that was presented.

This is also the place where concurrency caused a real problem. Two refresh calls arriving at the
same time could both read the same row as still valid and both create their own replacement. To fix
it I wrapped the whole read, check, insert and update inside one transaction with
`SELECT ... FOR UPDATE`, which is the same row locking already used while consuming an email
verification token.

### 404 instead of 403 on private events

If a private event returns `403` to someone who is not the owner, that already tells them the event
exists. So for private events a non owner gets `404` instead, on `GET`, `PUT` and `DELETE`. Public
events are a different case because everyone can see them anyway, so editing or deleting someone
else's public event returns a normal `403`.

### Knex instead of an ORM

The brief asked for a query builder and it fits this app anyway. `GET /api/events` builds its
`WHERE` and `ORDER BY` at runtime from search text, tag, visibility, upcoming or past status and six
sort options, and sorting by popularity needs a grouped subquery over `event_rsvps`. With an ORM
that kind of query usually ends up being written around the abstraction instead of through it.
Migrations and transactions are plain Knex as well, so there is one way of doing everything that
touches the database.

### The rest, briefly

- Routes call services directly, with no controller or repository layer. `*.routes.ts` handles the
  HTTP part and calls into `*.service.ts`, which holds the logic and its own queries. With three
  modules, two more layers would only mean more files to open for a single request.
- React Query holds all the server state. The main reason was invalidation rather than caching,
  since `invalidateQueries(['events'])` after a mutation is safer than syncing a going count between
  the list and the detail page by hand.
- React Hook Form with Zod for the forms, and the same rules run again on the backend. The frontend
  validation is only for feedback because anyone can skip it with curl, so the backend one is the
  real check.
- 2FA uses a `pre_auth` token instead of a second login. A password check on a 2FA account returns a
  5 minute narrowly typed JWT which `requireAuth` refuses, so it only works at `/auth/2fa/verify`.
  There are no recovery codes, which is noted in Assumptions.
- Tags are freeform and get resolved or created inline in the same transaction as the event, so
  there is no separate create tag endpoint to keep in sync.
- The usual security middleware is in place, `helmet()`, a CORS allowlist instead of a wildcard,
  `express-rate-limit`, bcrypt and `winston` for structured logs.
- Swagger is generated from the running server at `/api/docs` so the docs cannot drift from the code.
- `frontend/` and `backend/` are kept as separate npm projects, since a shared types package would
  be more tooling than a two app repo needs.

## Assumptions

### Business Assumptions

* **RSVP has no explicit "not answered" status.** A missing RSVP row means the user has not responded. Clearing an RSVP deletes the row, keeping "unanswered" distinct from `not_going`.
* **Popularity is based only on `going` RSVPs.** `maybe` responses do not contribute because they do not represent confirmed attendance.
* **Tag names are case-insensitive.** "Design" and "design" resolve to the same tag rather than creating duplicate tags.
* **Email verification is a soft gate.** Unverified users can still log in and use the application.
* **Any authenticated user can RSVP to any event they can view**, including their own. There is no invitation or attendee-approval system.
* **RSVP closes once an event has ended.** A past event keeps its final going count, but the controls are hidden in the UI and the API rejects any new or changed response with a `400`. The check runs against the database clock, not the browser's.
* **New events default to `public` visibility** when no visibility is specified.
* **Email addresses are case-insensitive.** `Ada@Example.com` and `ada@example.com` are treated as the same account for registration and login.
* **New events must start at least 24 hours from creation time**, not just "in the future." This only applies when `startsAt` is being set, so editing other fields on an event whose start time has since drifted under 24 hours away still works.
* **`endsAt` must be at least 15 minutes after `startsAt`.**
* **The event API exposes the creator's name and nothing else about them.** No email, no avatar image, and no profile to visit. The circle shown beside the name is just their initials rendered in the UI, so no extra data is fetched or stored for it.
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
