# Evently: Event Planning App

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
npm run seed:run   # optional, loads demo users and events (see below)
npm run dev
```

Runs on `http://localhost:4000`. Interactive API docs (Swagger UI) at
`http://localhost:4000/api/docs`.

`seed:run` loads 8 users and 35 events: 22 upcoming public, 7 past, 5 private and 1 in progress,
with tags and a mix of RSVPs so filtering, sorting by popularity and pagination all have data. Every
seeded user has the password `Demo1234!`. Each run deletes and recreates only the seeded accounts
and their events, so anything you registered yourself is kept, but changes made while logged in as a
seeded user are reset.

| Use it for | Email |
|---|---|
| Owner of most events, including private ones | `demo@evently.dev` |
| Second account, to check private events and edit/delete stay creator-only | `demo2@evently.dev` |
| Seeing the "verify your email" banner | `unverified@evently.dev` |

The other five (`priya`, `marcus`, `yuki`, `sofia`, `omar` `@evently.dev`) exist to create events
and RSVPs. Seeded accounts start with 2FA off; if you turn it on, running `seed:run` again turns it
off. Seed data is optional, `/register` works too.

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
npm install   # at the repo root, sets up a pre-commit hook that typechecks both apps
```

### Other useful scripts

| Location | Script | Does |
|---|---|---|
| `backend/` | `npm run typecheck` | `tsc --noEmit` |
| `backend/` | `npm run build` / `npm start` | compile to `dist/`, then run it |
| `backend/` | `npm run migrate:rollback` | undo the last migration batch |
| `backend/` | `npm run migrate:make <name>` | scaffold a new migration |
| `backend/` | `npm run seed:run` | reset the seeded demo users and their events (see Setup step 2) |
| `frontend/` | `npm run typecheck` | `tsc --noEmit` |
| `frontend/` | `npm run build` / `npm run preview` | production build, then serve it locally |

## Engineering decisions

Each decision below says what was built, where it lives, and why.

### 1. Short access token + rotating refresh token

**What**
- Login returns a 15 minute JWT access token (`type: 'access'`), verified without a database hit.
- It also sets a 30 day refresh token: an opaque random string in an httpOnly cookie
  (`refresh_token`, scoped to `/api/auth`). Only its SHA-256 hash is stored, in a `refresh_tokens`
  row with device label, IP, expiry and revocation state.
- Every `POST /auth/refresh` revokes the presented row and links it to its replacement through
  `replaced_by_id`.
- Reuse detection: if an already rotated token comes back, it must have leaked, so every session of
  that user is revoked.
- The rotation runs in one transaction with `SELECT ... FOR UPDATE`, so two refresh calls at the
  same moment cannot both rotate the same token. Expiry is compared against the database clock.
- Logout revokes only the current device's row, so other devices stay signed in.
- On the frontend, a 401 triggers one silent refresh and a retry. Concurrent 401s share a single
  refresh call, and a failed refresh ends the session.

**Where**
- `backend/src/modules/auth/refresh-tokens.service.ts` for create, rotate, revoke and reuse detection
- `backend/src/modules/auth/auth.routes.ts` for `/refresh`, `/logout` and the cookie options
- `backend/src/middleware/auth.ts`: `requireAuth` accepts only `type: 'access'` tokens
- `frontend/src/api/client.ts` for the axios refresh and retry interceptor

**Why**
- A single long lived JWT cannot be revoked, so logout would not really log anyone out.
- Keeping the access token short limits the damage if it leaks, while the refresh token is out of
  reach of JavaScript.
- Storing the refresh token as a row, instead of a version number on `users`, allows per device
  logout and detecting a stolen token.

### 2. Two-factor authentication (TOTP)

**What**
- Setup generates a secret and a QR code. 2FA only turns on after the user confirms a valid code
  from their authenticator app, so a failed scan cannot lock them out.
- Login on a 2FA account does not return a session. It returns a 5 minute `pre_auth` JWT, which
  `requireAuth` rejects, and which is only accepted by `POST /auth/2fa/verify` together with the
  6 digit code.
- Disabling 2FA requires the account password, not only a logged in session.
- The verify and enable endpoints have their own rate limit of 5 attempts per minute, on top of the
  general auth limiter.

**Where**
- `backend/src/modules/auth/totp.ts` wraps `otplib` and `qrcode`
- `backend/src/modules/auth/auth.routes.ts` for `/2fa/setup`, `/2fa/enable`, `/2fa/disable` and
  `/2fa/verify`
- `backend/src/middleware/rateLimit.ts` for the 2FA limiters
- `frontend/src/pages/SecurityPage.tsx`, `frontend/src/hooks/use-two-factor.ts`, and the code step in
  `frontend/src/pages/LoginPage.tsx`

**Why**
- A typed `pre_auth` token keeps the second step stateless and makes it impossible to use a half
  finished login as a real session.
- Asking for the password on disable means a stolen access token alone cannot remove 2FA.
- A 6 digit code can be guessed if unlimited, so the strict per minute limit matters.

### 3. React Query for server state

**What**
- Every API read goes through a React Query hook, and every write is a mutation.
- After a mutation (create, edit, delete, RSVP), `invalidateQueries(['events'])` refetches the list
  and the detail page together.
- Queries use a 5 minute `staleTime`, so moving between the list and an event reuses cached data
  instead of refetching on every page change.
- Event query keys include the access token, since the response depends on who is asking, and the
  whole cache is cleared on login, logout and session expiry.

**Where**
- `frontend/src/query/events/use-events.ts`, `use-event.ts` and `frontend/src/query/tags/use-tags.ts`
- Mutations in the pages, for example `frontend/src/pages/EventDetailPage.tsx`
- `frontend/src/contexts/auth.tsx` clears the cache when the user changes

**Why**
- Invalidation is safer than keeping a going count in sync between two pages by hand.
- The cache avoids redundant requests, and your own changes still show immediately because
  mutations invalidate it.
- Clearing on user change stops one user's private events showing for the next person in the same
  tab.

### 4. Knex query builder instead of an ORM

**What** `GET /api/events` builds its `WHERE` and `ORDER BY` at runtime from search, tag,
visibility, upcoming or past, and six sort options. Popularity sorting uses a grouped subquery over
`event_rsvps`. Migrations and transactions use Knex too.

**Where** `backend/src/modules/events/events.service.ts`, `backend/migrations/`

**Why** The brief asked for a query builder, and dynamic queries like this are usually written
around an ORM rather than through it.

### 5. 404 instead of 403 on private events

**What** A non owner gets `404` for a private event on `GET`, `PUT` and `DELETE`. Editing someone
else's public event returns `403`.

**Where** `backend/src/modules/events/events.routes.ts`

**Why** A `403` would confirm that the private event exists.

### 6. Routes call services directly

**What** Each backend module has `*.routes.ts` for HTTP, `*.service.ts` for logic and queries and
`*.types.ts` for types, plus `*.schemas.ts` for Zod validation where the module accepts input. There
is no controller or repository layer.

**Where** `backend/src/modules/auth`, `events` and `tags`

**Why** With three modules, two extra layers would only mean more files to open for one request.

### 7. Validation on both sides

**What** React Hook Form with Zod on the frontend, and Zod again on every backend route.

**Where** `frontend/src/pages/*FormPage.tsx` and the login and register pages, plus
`backend/src/modules/*/*.schemas.ts`

**Why** Frontend validation is only for feedback, since anyone can skip it with curl. The backend
check is the real one.

### 8. Tags created inline

**What** Tags are freeform. They are resolved or created in the same transaction as the event, and
matched case-insensitively.

**Where** `backend/src/modules/events/events.service.ts`

**Why** No separate create tag endpoint to keep in sync, and no half saved event if a tag insert
fails.

### 9. Security middleware and docs

**What** `helmet()`, a CORS allowlist instead of a wildcard, `express-rate-limit`, bcrypt password
hashing, `winston` structured logs, and Swagger generated at `/api/docs`.

**Where** `backend/src/app.ts`, `backend/src/middleware/`, `backend/src/docs/openapi.ts`

**Why** These are the standard protections for a public API, and generated docs cannot drift from
the code.

## Assumptions

### Business Assumptions

Each point says what was assumed and how it shaped the implementation.

**Events**

* **Events need 24 hours' notice.**
  Assumed: an event created for an hour from now is not really planned.
  Effect: `startsAt` must be at least 24 hours ahead, checked when it is set. Editing only the title
  of an event starting tomorrow still works.
* **An event lasts at least 15 minutes.**
  Assumed: shorter events are mistakes.
  Effect: `endsAt` must be 15 minutes or more after `startsAt`, checked on create and on edit, even
  when only one of the two changes.
* **Events are public unless the creator says otherwise.**
  Assumed: most events are meant to be found.
  Effect: `visibility` defaults to `public`.
* **Private means only the creator can see it.**
  Assumed: there are no invites or shared access.
  Effect: private events are left out of lists for everyone else, and opening one returns `404`.
* **"Upcoming" and "Past" are split by start and end time.**
  Assumed: an event is upcoming until it starts, and past once it ends.
  Effect: upcoming is `starts_at >= now` and past is `ends_at < now`, so an event in progress right
  now shows in neither tab.
* **The creator can still edit or delete an event after it ends.**
  Assumed: hosts may want to fix details later.
  Effect: there is no end check on edit or delete, but a new start time must still be 24 hours ahead.
* **Only the creator is shown, by name.**
  Assumed: other users do not need a host's email or profile.
  Effect: the API returns only `creatorName`, and the avatar is just initials drawn in the UI.
* **No photo uploads.**
  Assumed: images are not needed to plan an event.
  Effect: each cover is a gradient generated from the title and id, so there is no file storage.
* **Times are stored in UTC.**
  Assumed: users can be in different time zones.
  Effect: the database stores UTC and the browser shows each time in the viewer's local time.

**RSVP**

* **One response per person per event: going, maybe or can't go.**
  Assumed: there is no invite list or host approval.
  Effect: any logged in user who can see an event can respond, and the table's primary key
  (`event_id`, `user_id`) stops duplicates.
* **No response is different from "can't go".**
  Assumed: silence is not a no.
  Effect: there is no "unanswered" status; no row means no response, and clearing a response deletes
  the row.
* **The host does not RSVP to their own event.**
  Assumed: hosting implies attending.
  Effect: the RSVP buttons are hidden for the creator. The API does not block it.
* **RSVP closes when the event ends.**
  Assumed: you cannot change your answer for something already over.
  Effect: the buttons are hidden and the API returns `400`, checked against the database clock, not
  the browser's. The final count stays, shown as "went".
* **Popularity means confirmed attendance.**
  Assumed: "maybe" is not a commitment.
  Effect: sorting by popularity counts only `going` responses.

**Tags, search and lists**

* **Tags are freeform and case-insensitive.**
  Assumed: users should not need an admin to create a tag, and "Design" and "design" are the same.
  Effect: unknown tags are created while saving the event, and existing ones are reused with their
  stored spelling. Tags no longer used by any event stay in the suggestion list.
* **Search looks at title, description and location.**
  Assumed: people search for what or where, not only the name.
  Effect: one search box matches any of the three.
* **Lists are paged and sorted by start date by default.**
  Assumed: the soonest events matter most.
  Effect: 20 events per page by default, 100 at most, sorted by start time ascending.

**Accounts**

* **Emails are not case-sensitive.**
  Assumed: `Ada@Example.com` and `ada@example.com` are the same person.
  Effect: emails are trimmed and lowercased before register and login.
* **Email verification is a soft gate.**
  Assumed: blocking unverified users would hurt more than it protects in an events app.
  Effect: unverified users can log in and use everything, and they see a banner with a resend
  button.
* **Deleting a user deletes their data.**
  Assumed: nothing should remain without its owner.
  Effect: foreign keys cascade, so a user's events, RSVPs and sessions go with them. An event's tags
  and RSVPs are removed with the event.

### Data Model Assumptions

Each point gives the relationship, what was assumed, and how the schema enforces it. Full column
details are in `docs/database-schema.md`.

* **Users → Events: one-to-many.**
  Assumed: every event has exactly one creator, with no co-hosts or shared editing.
  Effect: `events.creator_id` is a required foreign key to `users` with `ON DELETE CASCADE`, so
  deleting a user deletes their events.
* **Events ↔ Tags: many-to-many through `event_tags`.**
  Assumed: an event can have several tags, and one tag is shared by many events.
  Effect: `event_tags` has a composite primary key (`event_id`, `tag_id`), so the same tag cannot be
  attached twice. `tags.name` is `UNIQUE` under a case-insensitive collation, so "Design" and
  "design" cannot both exist. Deleting an event removes its links but keeps the tag.
* **Users ↔ Events (RSVP): many-to-many through `event_rsvps`.**
  Assumed: a person gives one answer per event and can change it.
  Effect: the composite primary key (`event_id`, `user_id`) allows only one row per pair, so
  changing an answer updates that row. `status` is a MySQL enum (`going`, `maybe`, `not_going`), and
  both foreign keys cascade.
* **Users → Refresh tokens: one-to-many.**
  Assumed: one user can be signed in on several devices at once.
  Effect: one `refresh_tokens` row per session, holding only a SHA-256 hash of the token. A
  self-referencing `replaced_by_id` links each rotated token to the one that replaced it, which is
  what reuse detection reads.
* **Users → Email verifications: one-to-many in the schema, one active in practice.**
  Assumed: only the latest emailed link should work.
  Effect: resending deletes the old row and inserts a new one in the same transaction. This is
  enforced in code, not by a `UNIQUE` constraint. Only the token hash is stored.
* **Users → 2FA secret: at most one, stored on `users`.**
  Assumed: one authenticator per account, so no separate table is needed.
  Effect: `totp_secret` is nullable and `two_factor_enabled` is a separate flag. The secret is saved
  at setup but only counts once the flag is set by a confirmed code, and disabling clears both.
* **Every event has an end time.**
  Assumed: past or upcoming status and closing RSVPs depend on when an event finishes.
  Effect: `ends_at` is `NOT NULL`. It was added in a later migration, which gave existing rows a
  default of 30 minutes after `starts_at`.
* **Times are stored without a time zone, as UTC.**
  Assumed: the server and every client agree on UTC.
  Effect: columns are `DATETIME`, the Knex connection uses `timezone: 'Z'`, and date comparisons use
  the database clock.
* **Nothing is soft deleted.**
  Assumed: deleted data does not need to be restored.
  Effect: deletes are real `DELETE`s, and foreign keys cascade to clean up dependent rows.

### Deliberate Limitations

Known gaps, left out on purpose to keep the scope of a take-home. Each says what it means today and
how it would be fixed.

**Accounts**

* **No password reset, password change, profile edit or account deletion.**
  Today: a forgotten password means a new account.
  Fix: a reset flow using the same hashed, expiring token pattern as email verification.
* **2FA has no recovery codes.**
  Today: losing the authenticator device locks the account, since disabling 2FA needs a login.
  Fix: issue one-time hashed backup codes when 2FA is enabled.

**Security**

* **`totp_secret` is stored in plain text.**
  Today: anyone with a copy of the database could generate valid 2FA codes.
  Fix: encrypt the column with a key kept outside the database.
* **The access token is kept in `localStorage`.**
  Today: an XSS bug could read it. The damage is limited because it expires after 15 minutes and
  the refresh token stays in an httpOnly cookie.
  Fix: keep the access token in memory only and get a new one on page load.
* **Content Security Policy is turned off.**
  Today: `helmet()` runs with `contentSecurityPolicy: false` for the whole API, because Swagger UI
  needs inline scripts. `/api/docs` is also public.
  Fix: turn CSP off only for the docs route, and hide the docs in production.
* **Rate limits are loose and kept in memory.**
  Today: auth allows 200 failed requests per 10 minutes per IP, and counters reset when the server
  restarts or when running more than one instance.
  Fix: a tighter login limit and a shared store such as Redis.

**Data and behaviour**

* **Events in progress show in neither tab.**
  Today: Upcoming is "not started yet" and Past is "already ended".
  Fix: let Upcoming mean "not ended yet".
* **Search does not escape `%` and `_`.**
  Today: searching for `%` matches every event. It is not an injection risk, since values are bound
  parameters.
  Fix: escape both characters before building the `LIKE` pattern.
* **Expired tokens are never cleaned up.**
  Today: revoked or expired `refresh_tokens` and `email_verifications` rows stay in the database.
  Fix: a scheduled job that deletes old rows.
* **The 24 hour rule uses the server clock.**
  Today: `startsAt` is checked against the Node process time, while other time checks use the
  database clock. They only differ if the two machines' clocks drift.
  Fix: compare against the database time in the same query.

**Testing**

* **No automated tests.**
  Today: behaviour was checked by hand with Postman, Swagger UI and the browser.
  Fix: integration tests for the auth and event routes against a test database, starting with
  refresh rotation, private event access and the RSVP rules.
