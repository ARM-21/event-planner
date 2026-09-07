# API contract

Base path: `/api`. All request/response bodies are JSON
(`Content-Type: application/json`). Timestamps are ISO 8601 UTC strings
(`2026-09-03T12:00:00.000Z`), matching the UTC `DATETIME` columns in
`docs/database-schema.md`.

## Auth

Two JWTs, not one: a short-lived **access token** and a longer-lived
**refresh token**.

- The access token is what `Authorization: Bearer <token>` carries on
  every identity-requiring request. Payload: `{ sub: userId, ver, type: 'access', iat, exp }`.
  Expires in **15 minutes**. Returned in the response body by
  `register`/`login`/`refresh` — the frontend keeps it in memory/localStorage,
  same as before.
- The refresh token is never exposed to JS: it's set as an **httpOnly
  cookie** (`refresh_token`, `Path=/api/auth`, 30-day `Max-Age`) by
  `register`/`login`/`refresh`, and read back only from that cookie.
  Payload: `{ sub: userId, ver, type: 'refresh', iat, exp }`. In production
  it's also `Secure` + `SameSite=None` (frontend/backend may be on
  different domains); in dev it's `SameSite=Lax` without `Secure` (plain
  http, same-site by port).
- `ver` is the user's `token_version` (see `docs/database-schema.md`) at
  the time the token was issued. `requireAuth`/`optionalAuth` check
  `type === 'access'` but *not* `ver` — access tokens are trusted
  statelessly for their whole (short) 15-minute life. Only
  `POST /auth/refresh` checks `ver` against the current DB value, which is
  what makes `POST /auth/logout` (which bumps it) an actual revocation
  rather than just "the frontend forgot the token".
- Clients need `credentials: 'include'` (axios: `withCredentials: true`)
  for the refresh cookie to round-trip at all.

### `POST /api/auth/refresh`

No body, no `Authorization` header — identity comes entirely from the
`refresh_token` cookie. On success, issues **both** a new access token and
a rotated refresh cookie (sliding 30-day expiry from the last refresh, not
a hard cutoff from login) and responds `200 { "token": "<new access token>" }`.

Errors: `401` if the cookie is missing, invalid/expired, the wrong `type`,
or its `ver` no longer matches the user's current `token_version` (i.e.
it's been revoked by a logout since it was issued).

### `POST /api/auth/logout`

No body. Not auth-gated by `Authorization` — works even with an already-expired
access token, since that's exactly when someone still holding a long-lived
refresh cookie needs logout to actually revoke it. Increments the caller's
`token_version` (identified from the refresh cookie, if present — ignoring
its own expiry, so an expired-but-correctly-signed cookie can still be
attributed and revoked) and clears the cookie. A missing/unreadable cookie
is a no-op, same shape as `DELETE /events/:id/rsvp`.

Response: `204` no body, always (nothing to reveal either way about whether
a session existed).

### `POST /api/auth/register`

Request:
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "at-least-8-chars" }
```

Response `201`:
```json
{ "user": { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "emailVerified": false }, "token": "<jwt>" }
```

Registration also creates a single-use verification token and "sends" a link
`{FRONTEND_URL}/verify-email?token=<raw token>` (in dev this is just logged to
the backend console — see `backend/src/modules/auth/mailer.ts`). The account
is usable immediately (login isn't blocked on verification); `emailVerified`
is exposed on the user object so the frontend can prompt for it.

Errors: `400` validation (missing/short fields), `409` email already registered.

### `POST /api/auth/login`

Request: `{ "email": "ada@example.com", "password": "..." }`

Response `200`: same shape as register — **unless** the account has 2FA
enabled, in which case it's instead
`{ "twoFactorRequired": true, "preAuthToken": "<jwt>" }` (see "Two-factor
authentication" below).

Errors: `400` validation, `401` invalid credentials (same message whether the
email doesn't exist or the password is wrong — don't leak which).

## Two-factor authentication

TOTP-based (RFC 6238, the same algorithm Google Authenticator/Authy/etc.
implement) and opt-in. Four endpoints, plus one change to `login`'s
behavior on a 2FA-enabled account.

- **Enrollment** — `POST /auth/2fa/setup` (auth required) generates a new
  secret, saves it *without* enabling 2FA yet, and returns
  `{ "secret": "<base32>", "qrCodeDataUrl": "data:image/png;base64,..." }`.
  The frontend shows the QR (scan with an authenticator app) and the raw
  secret (manual entry fallback). `409` if 2FA is already enabled — disable
  it first to re-configure.
- **Confirmation** — `POST /auth/2fa/enable` (auth required),
  `{ "code": "123456" }`. Verifies the code against the secret `/setup`
  just saved, and only then flips `two_factor_enabled` on. This
  confirmation step exists so a failed/abandoned QR scan can't silently
  lock the user out — 2FA never turns on until they've proven the code
  actually works. `400` if `/setup` was never called; `401` on a wrong code.
- **Turning it off** — `POST /auth/2fa/disable` (auth required),
  `{ "password": "..." }`. Requires the current password, not just a valid
  access token — otherwise a stolen/compromised access token could
  silently strip 2FA off the account, defeating the point of having it.
  Clears both `two_factor_enabled` and the stored secret; response `204`.
  `401` on an incorrect password.
- **Login's second step** — when `login` returns `twoFactorRequired`, the
  frontend collects a code and calls `POST /auth/2fa/verify`,
  `{ "preAuthToken": "<jwt from login>", "code": "123456" }`. On success,
  responds `200` with the same `{ user, token }` shape (and sets the
  refresh cookie) as a normal login — this is genuinely the point identity
  is established, not `login` itself. `401` on an invalid/expired
  pre-auth token or a wrong code.

The pre-auth token is a real JWT but a deliberately weak one: 5-minute
expiry, `type: 'pre_auth'` (rejected by `requireAuth`, which only accepts
`type: 'access'` — the same type-tagging mechanism that keeps refresh
tokens from being usable as access tokens also keeps a pre-auth token from
being usable as either). It proves only "this caller knows the password";
`/2fa/verify` is what proves "and controls the second factor too."

Code verification tolerates ±30 seconds of clock drift between the server
and the authenticator app (`epochTolerance: 30` in `otplib`). All of
`/auth/2fa/*` inherits the general auth-endpoint rate limit (10
requests/15min per IP, failed requests only) — but `/2fa/verify` and
`/2fa/enable` specifically, the two endpoints that accept a code guess,
each *also* carry their own tighter limiter on top: **5 requests/minute
per IP** (also failed-only) — two independent limiter instances, one per
endpoint, not one shared budget, so exhausting one doesn't block the
other. A 15-minute-scale budget makes sense for password attempts; it's
far too loose for a 6-digit code, so the
code-guessing endpoints get their own faster-resetting one instead of
sharing the password-oriented budget.

### `POST /api/auth/verify-email`

Request: `{ "token": "<raw token from the emailed link>" }`

Response `200`: `{ "verified": true }`. The token is single-use and expires
24 hours after issue (`email_verifications.expires_at`); either failure case
returns the same `400`.

Errors: `400` missing/invalid/expired token.

### `POST /api/auth/resend-verification` (auth required)

No body. Issues a fresh token for the caller's own account (invalidating any
previous outstanding one) and re-sends the link. Response `200`:
`{ "message": "Verification email sent" }`.

Errors: `409` email is already verified, `401` no/invalid token.

## Events

`visibility` is `"public" | "private"`. A private event is only returned to
its creator; everyone else gets `404` (not `403`) so existence isn't leaked.

### `GET /api/events`

Query params (all optional):

| param        | type                  | default | notes                                   |
|--------------|-----------------------|---------|------------------------------------------|
| `page`       | int ≥ 1               | 1       |                                          |
| `limit`      | int, 1–100            | 20      |                                          |
| `search`     | string                | —       | matches `title`, `description`, or `location` |
| `tag`        | string                | —       | filter to events tagged with this name  |
| `visibility` | `public`\|`private`   | —       | private only honored for the requester's own events |
| `from`       | ISO date              | —       | `starts_at >= from`                     |
| `status`     | `upcoming`\|`past`    | —       | compared against the server's clock, not `from` |
| `sort`       | `starts_at`\|`-starts_at`\|`popularity`\|`-popularity`\|`created_at`\|`-created_at` | `starts_at` | `-` prefix = descending; `popularity` orders by how many `going` RSVPs an event has (see `event_rsvps` in `docs/database-schema.md`); `created_at` sorts by when the event was added, not `starts_at` |

Unauthenticated or authenticated-but-not-owner requests are implicitly
restricted to `visibility = 'public'`; an authenticated user additionally
sees their own private events.

Response `200`:
```json
{
  "data": [
    {
      "id": 10,
      "title": "Launch party",
      "description": "...",
      "startsAt": "2026-10-01T18:00:00.000Z",
      "endsAt": "2026-10-01T20:00:00.000Z",
      "location": "Kathmandu",
      "visibility": "public",
      "creatorId": 1,
      "tags": ["launch", "party"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### `POST /api/events` (auth required)

Request:
```json
{
  "title": "Launch party",
  "description": "optional",
  "startsAt": "2026-10-01T18:00:00.000Z",
  "endsAt": "2026-10-01T20:00:00.000Z",
  "location": "Kathmandu",
  "visibility": "public",
  "tags": ["launch", "party"]
}
```

`tags` is a list of tag names; unknown names are created. `creatorId` comes
from the JWT, never the body. `startsAt` must be at least 24 hours from the
time of the request (a business rule, not just "in the future") — this is
re-checked on `PUT` too, but only when `startsAt` is actually part of that
request. `endsAt` must be at least 15 minutes after `startsAt`. Response
`201`: the created event (same shape as list items).

Errors: `400` validation (empty title, `startsAt` not parseable/less than 24h
out, `endsAt` less than 15 minutes after `startsAt`, etc.), `401` no/invalid
token.

### `GET /api/events/:id`

Response `200`: single event, plus an `rsvp` field not present on list
items:
```json
{ "id": 10, "title": "...", "...": "...", "rsvp": { "goingCount": 3, "myStatus": "going" } }
```
`myStatus` is `"going"`, `"maybe"`, `"not_going"`, or `null` (anonymous
caller, or no RSVP recorded yet — those are the same "no answer" state).
`goingCount` only counts `going` rows (a `maybe` doesn't count toward it),
and is public regardless of who's asking.

`404` if the event doesn't exist, or exists but is private and the
requester isn't the creator.

### `PUT /api/events/:id` (auth, creator only)

Same body shape as create (partial updates allowed — omitted fields are
unchanged). Response `200`: updated event.

Errors: `400` validation, `401` no/invalid token, `403` authenticated but not
the creator of a **public** event, `404` event doesn't exist — or exists but
is **private** and the requester isn't the creator (same existence-hiding
rule as `GET`; a non-owner must not be able to tell a private event apart
from a nonexistent one by getting `403` instead of `404`).

### `DELETE /api/events/:id` (auth, creator only)

Response `204` no body. Errors: `401`, `403`, `404` — same rules as `PUT`.

### `PUT /api/events/:id/rsvp` (auth required)

Request: `{ "status": "going" | "maybe" | "not_going" }`. Upsert — calling
this again just changes the caller's own existing answer, and any
authenticated user may RSVP to any event they can already `GET` (including
their own, though the frontend doesn't surface the control to the event's
creator). Response `200`: `{ "goingCount": 3, "myStatus": "going" }`.

Errors: `400` validation (status isn't one of the three values), `401`
no/invalid token, `404` event doesn't exist or is private and hidden from
this requester — same existence-hiding rule as `GET /api/events/:id`, so
this can't be used to probe for a private event's existence either.

### `DELETE /api/events/:id/rsvp` (auth required)

Clears the caller's own RSVP entirely, back to "no response" — distinct
from setting `status` to `"not_going"`, which is still a recorded answer.
No-op (still `204`) if the caller had no RSVP recorded.

Response `204` no body. Errors: `401`, `404` — same rules as `PUT .../rsvp`.

## Tags

### `GET /api/tags`

Response `200`: `{ "data": [{ "id": 1, "name": "launch" }, ...] }` — no
pagination, list is expected to stay small. Used to power tag-filter/autocomplete
UI.

Tags are otherwise created implicitly through `POST`/`PUT /api/events` — there
is no standalone `POST /api/tags`.

## Error format

Every non-2xx response body:
```json
{ "error": { "message": "Human-readable summary", "details": [ { "field": "email", "message": "..." } ] } }
```

`details` is present only for `400` validation errors and omitted otherwise.

| status | meaning                                          |
|--------|---------------------------------------------------|
| 400    | validation failure                                 |
| 401    | missing/invalid/expired token, or bad credentials  |
| 403    | authenticated, but not authorized for this action  |
| 404    | resource doesn't exist (or is hidden from you)     |
| 409    | conflict with the resource's current state (duplicate email on register, resending a verification email that's already verified) |
| 429    | rate limit exceeded (300 req/15min per IP overall; 10 req/15min per IP on `/api/auth/*`, not counting successful requests) |
| 500    | unhandled server error                             |

## Security middleware

- `helmet()` sets standard security headers (HSTS, no-sniff, frameguard,
  etc.); CSP is disabled since this is a JSON API plus the swagger-ui docs
  page, which needs inline scripts CSP would otherwise block.
- CORS is restricted to `CORS_ORIGIN` (comma-separated) / `FRONTEND_URL`,
  not a wildcard.
- JSON request bodies are capped at 10kb (`express.json({ limit: '10kb' })`)
  — there are no file-upload endpoints.
- Responses are gzip-compressed (`compression()`).
