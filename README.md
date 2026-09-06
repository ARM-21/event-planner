# Evently — Event Planning App

A full-stack event planning app: create, browse, and RSVP to events, with tag-based
categorization, public/private visibility, and JWT-based auth. Built as a take-home
assessment; see `docs/api-contract.md` and `docs/database-schema.md` for full API and
schema reference, and `docs/progress.md` for a detailed build log.

**Tech stack:** React + TypeScript (frontend), Express + TypeScript (backend), MySQL via
Knex.js (no ORM), Tailwind CSS.

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
npm run dev
```

Runs on `http://localhost:4000`. Interactive API docs (Swagger UI) at
`http://localhost:4000/api/docs`.

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
| `frontend/` | `npm run typecheck` | `tsc --noEmit` |
| `frontend/` | `npm run build` / `npm run preview` | production build, then serve it locally |

## Engineering decisions

- **Knex, not an ORM** — per the assessment's constraint. Query builders (`db('events').where(...)`)
  stay close to the SQL actually being run, which matters for the pagination/filtering/sorting
  logic in `GET /api/events` (dynamic `WHERE`/`ORDER BY` composition, a subquery for
  popularity sort) that would be awkward to express through most ORMs' abstractions anyway.
- **JWT access + refresh, not a single long-lived token.** A 15-minute access token is trusted
  statelessly (no DB hit per request); a 30-day refresh token lives in an **httpOnly cookie**
  (never touched by JS) and is the only thing checked against the DB (`users.token_version`) —
  once per refresh, not once per request. Logging out bumps `token_version`, instantly revoking
  every outstanding refresh token. Deliberately scoped to a single global counter rather than a
  per-session `refresh_tokens` table — real revocation without per-device tracking, session
  listing, or reuse detection, none of which this app currently needs. See `docs/api-contract.md`
  for the full token lifecycle.
- **Existence-hiding for private events.** A non-owner hitting a private event's `GET`/`PUT`/`DELETE`
  gets `404`, not `403` — a `403` would confirm the event exists to someone who can't even see it.
- **Tags are freeform and implicit.** No standalone "create tag" endpoint; tag names are
  resolved-or-created inline when an event is written, inside the same transaction as the event
  itself so a partial write can't orphan a tag or leave an event with half its tags.
- **RSVP has no "not answered" status value.** A user with no row for an event simply hasn't
  answered — clearing an RSVP deletes the row rather than writing a third status, keeping "no
  answer" and "answered not_going" distinguishable.
- **Validation on both ends, same rules, two implementations.** Zod schemas on both frontend
  (form validation, immediate feedback) and backend (`events.schemas.ts`, `auth.schemas.ts` —
  the actual trust boundary, since the frontend's checks are only a UX convenience an API
  client could skip entirely).
- **Security middleware:** `helmet()`, a CORS allowlist (not a wildcard), `express-rate-limit`
  (global + a tighter limit on `/api/auth/*`), bcrypt for password hashing, and structured
  request logging via `winston`.
- **API docs generated, not hand-maintained separately** — `swagger-ui-express` serves the spec
  at `/api/docs` directly from the running server.
- **No shared monorepo tooling.** `frontend/` and `backend/` are independent npm projects with
  their own `package.json`/`tsconfig.json` — simplest thing that works for a two-app project
  this size; a shared-types package would be premature for the current scope.

## Assumptions

- **Session revocation is per-user, not per-device.** Logging out (or any future
  password-change flow) invalidates *every* device's refresh token at once, since there's one
  `token_version` counter per user rather than one row per issued token. Acceptable tradeoff for
  this app's scope; a `refresh_tokens` table would be the upgrade path if per-device "sign out
  this device only" became a real requirement.
- **Email verification is a soft gate.** An unverified account can log in and use the app fully;
  the UI just shows a dismissible-by-action banner nudging verification, rather than blocking
  access. Verification links are logged to the backend console in dev instead of actually
  emailed, since no SMTP/email-provider credentials were in scope.
- **Any authenticated user may RSVP to any event they can already view** — including their own,
  though the UI doesn't surface the RSVP control to an event's creator, since RSVPing to your
  own event isn't a meaningful action. There's no invitation system gating who's "allowed" to
  RSVP.
- **"Popularity" (for sorting) counts only `going` RSVPs** — a `maybe` doesn't contribute.
- **A new event defaults to `public` visibility** if not specified.
- **Two-factor authentication was scoped out.** Listed as an optional "advanced auth" feature in
  the brief; refresh tokens and email verification (also optional) were prioritized instead as
  higher-value for the time available.
- **No automated test suite.** Listed as optional ("additional coverage welcome"); verification
  throughout development was done via live manual/scripted testing against real dev servers
  (postman and swagger) rather than a committed test suite. 
