# API contract

Base path: `/api`. All request/response bodies are JSON
(`Content-Type: application/json`). Timestamps are ISO 8601 UTC strings
(`2026-09-03T12:00:00.000Z`), matching the UTC `DATETIME` columns in
`docs/database-schema.md`.

## Auth

Bearer JWT. Login/register return a token; every other endpoint that needs
identity reads it from `Authorization: Bearer <token>`. The token payload is
`{ sub: userId, iat, exp }` — no role/claims beyond identity, since
authorization is purely "are you the creator of this event."

### `POST /api/auth/register`

Request:
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "at-least-8-chars" }
```

Response `201`:
```json
{ "user": { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com" }, "token": "<jwt>" }
```

Errors: `400` validation (missing/short fields), `409` email already registered.

### `POST /api/auth/login`

Request: `{ "email": "ada@example.com", "password": "..." }`

Response `200`: same shape as register.

Errors: `400` validation, `401` invalid credentials (same message whether the
email doesn't exist or the password is wrong — don't leak which).

## Events

`visibility` is `"public" | "private"`. A private event is only returned to
its creator; everyone else gets `404` (not `403`) so existence isn't leaked.

### `GET /api/events`

Query params (all optional):

| param        | type                  | default | notes                                   |
|--------------|-----------------------|---------|------------------------------------------|
| `page`       | int ≥ 1               | 1       |                                          |
| `limit`      | int, 1–100            | 20      |                                          |
| `search`     | string                | —       | matches `title` (and `location`)        |
| `tag`        | string                | —       | filter to events tagged with this name  |
| `visibility` | `public`\|`private`   | —       | private only honored for the requester's own events |
| `from`       | ISO date              | —       | `starts_at >= from`                     |
| `status`     | `upcoming`\|`past`    | —       | compared against the server's clock, not `from` |
| `sort`       | `starts_at`\|`-starts_at` | `starts_at` | `-` prefix = descending           |

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

Response `200`: single event. `404` if it doesn't exist, or exists but is
private and the requester isn't the creator.

### `PUT /api/events/:id` (auth, creator only)

Same body shape as create (partial updates allowed — omitted fields are
unchanged). Response `200`: updated event.

Errors: `400` validation, `401` no/invalid token, `403` authenticated but not
the creator, `404` event doesn't exist.

### `DELETE /api/events/:id` (auth, creator only)

Response `204` no body. Errors: `401`, `403`, `404` — same rules as `PUT`.

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
| 409    | conflict (duplicate email on register)             |
| 500    | unhandled server error                             |
