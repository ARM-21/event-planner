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
- **JWT access + a `refresh_tokens` table, not one long-lived token.** A 15-minute access token
  is trusted statelessly (no DB hit per request); a 30-day refresh token is an opaque random
  value in an **httpOnly cookie** (never touched by JS), backed by a per-session DB row (hash,
  device label, IP, expiry, revocation state) — checked once per refresh, not once per request.
  Every refresh **rotates** the token and links the old row to the new one via `replaced_by_id`,
  which enables **reuse detection**: presenting a token that's already been rotated past can only
  mean it leaked, so that revokes every session for the user, not just the one in use. Logout
  revokes only the calling device's row — other sessions stay signed in. See
  `docs/database-schema.md` (`refresh_tokens`) and `docs/api-contract.md` for the full lifecycle.
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
- **2FA via a pre-auth token, not a second full login.** A password check on a 2FA-enabled
  account issues a short-lived (5 min), narrowly-typed `pre_auth` JWT instead of real tokens —
  `requireAuth` rejects it outright (it only accepts `type: 'access'`), so it's useless for
  anything except `POST /auth/2fa/verify`, which is what actually issues the real access token
  and refresh session once the TOTP code checks out. `otplib` generates
  the secret and verifies codes (RFC 6238, ±30s clock-drift tolerance); `qrcode` turns the
  `otpauth://` URI into a scannable PNG so the frontend needs no QR library of its own.
  Enrollment requires one successful code before `two_factor_enabled` flips on, so an
  abandoned/failed QR scan can't lock anyone out.
- **No shared monorepo tooling.** `frontend/` and `backend/` are independent npm projects with
  their own `package.json`/`tsconfig.json` — simplest thing that works for a two-app project
  this size; a shared-types package would be premature for the current scope.

## Assumptions

- **No session-management UI.** The `refresh_tokens` table already tracks enough per-device data
  (device label, IP, last issued) to list active sessions and let a user revoke one individually,
  but there's no `GET /auth/sessions`-style endpoint or frontend page for it yet — logout only
  ever acts on the calling device's own session. Straightforward to add on top of the existing
  table if it became a real requirement.
- **No cleanup job for expired/revoked refresh tokens.** Rows accumulate rather than being
  deleted — fine at this app's scale, but a real deployment would want a periodic sweep (or a
  lazy delete-on-lookup) once the table grows unbounded.
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
- **2FA has no backup/recovery codes.** Losing the authenticator device with no other way back.
- **No automated test suite.** Listed as optional ("additional coverage welcome"); verification
  throughout development was done via live manual/scripted testing against real dev servers
  (postman and swagger) rather than a committed test suite. 
