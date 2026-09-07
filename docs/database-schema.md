# Database schema

Here is the schema diagram of the tables and their relationships:
```
users ──< events ──< event_tags >── tags
users >── event_rsvps ──< events   (one row per user per event)
```

---

## users

| Column          | Type                | Constraints                 |
| --------------- | ------------------- | --------------------------- |
| `id`            | BIGINT UNSIGNED     | PK, AUTO_INCREMENT          |
| `name`          | VARCHAR(100)        | NOT NULL                    |
| `email`         | VARCHAR(255)        | NOT NULL, UNIQUE            |
| `password_hash` | VARCHAR(255)        | NOT NULL                    |
| `email_verified_at` | DATETIME        | NULL — set once the emailed link is confirmed |
| `token_version` | INT UNSIGNED        | NOT NULL, default `0` — see below |
| `totp_secret`   | VARCHAR(64)         | NULL — base32 TOTP secret, set by `POST /auth/2fa/setup` |
| `two_factor_enabled` | BOOLEAN        | NOT NULL, default `false` |
| `created_at`    | DATETIME            | NOT NULL, default now (UTC) |
| `updated_at`    | DATETIME            | NOT NULL, default now (UTC), auto-updated |

`token_version` backs refresh-token revocation (see "Auth tokens" in
`docs/api-contract.md`): every access/refresh JWT embeds the value it was
issued with, and `POST /auth/logout` increments this column, which
immediately invalidates every outstanding refresh token for that user
(checked on every `POST /auth/refresh`). Nothing currently reads or writes
it besides that one endpoint, but any other action that should force
re-authentication everywhere (e.g. a future change-password endpoint)
can reuse the same bump.

`totp_secret` is written by `/auth/2fa/setup` but doesn't turn anything on
by itself — `two_factor_enabled` only flips to `true` once `/auth/2fa/enable`
confirms the user can generate a valid code from it. A login on a
2FA-enabled account gets a short-lived pre-auth token instead of real
tokens; trading that plus a valid code for real tokens happens at
`/auth/2fa/verify`. See "Two-factor authentication" in
`docs/api-contract.md` for the full flow.


## events

| Column        | Type                       | Constraints                          |
| ------------- | -------------------------- | ------------------------------------ |
| `id`          | BIGINT UNSIGNED            | PK, AUTO_INCREMENT                   |
| `creator_id`  | BIGINT UNSIGNED            | NOT NULL, FK → `users.id`, CASCADE   |
| `title`       | VARCHAR(150)               | NOT NULL                             |
| `description` | TEXT                       | NULL                                 |
| `starts_at`   | DATETIME                   | NOT NULL (UTC)                       |
| `ends_at`     | DATETIME                   | NOT NULL (UTC), must be after `starts_at` |
| `location`    | VARCHAR(255)               | NOT NULL                             |
| `visibility`  | ENUM('public', 'private')  | NOT NULL, default `'public'`         |
| `created_at`  | DATETIME                   | NOT NULL, default now (UTC)          |
| `updated_at`  | DATETIME                   | NOT NULL, default now (UTC), auto-updated |

Indexes:

| Index                      | Serves                                              |
| -------------------------- | --------------------------------------------------- |
| `(starts_at)`              | Upcoming/past split, sorting by date                |
| `(creator_id)`             | "My events", and the ownership lookup before edits  |
| `(visibility, starts_at)`  | The main listing query, which filters on visibility and orders by date together |


## tags

| Column       | Type            | Constraints                 |
| ------------ | --------------- | ---------------------------- |
| `id`         | BIGINT UNSIGNED | PK, AUTO_INCREMENT          |
| `name`       | VARCHAR(50)     | NOT NULL, UNIQUE            |
| `created_at` | DATETIME        | NOT NULL, default now (UTC) |



## event_tags

| Column     | Type            | Constraints                         |
| ---------- | --------------- | ------------------------------------ |
| `event_id` | BIGINT UNSIGNED | NOT NULL, FK → `events.id`, CASCADE |
| `tag_id`   | BIGINT UNSIGNED | NOT NULL, FK → `tags.id`, CASCADE   |

| Index                            | Purpose                                       |
| --------------------------------- | ---------------------------------------------- |
| PRIMARY KEY `(event_id, tag_id)` | Natural key; makes duplicate assignment impossible |
| `(tag_id, event_id)`             | Reverse lookup: all events carrying a tag     |


## event_rsvps

| Column       | Type                          | Constraints                          |
| ------------ | ----------------------------- | ------------------------------------- |
| `event_id`   | BIGINT UNSIGNED               | NOT NULL, FK → `events.id`, CASCADE  |
| `user_id`    | BIGINT UNSIGNED               | NOT NULL, FK → `users.id`, CASCADE   |
| `status`     | ENUM('going', 'maybe', 'not_going') | NOT NULL                       |
| `created_at` | DATETIME                      | NOT NULL, default now (UTC)          |
| `updated_at` | DATETIME                      | NOT NULL, default now (UTC), auto-updated |

| Index                              | Purpose                                       |
| ----------------------------------- | ---------------------------------------------- |
| PRIMARY KEY `(event_id, user_id)`  | One RSVP per user per event; also the upsert target and what makes "going count for this event" a covered lookup |

No separate "no response" state is stored — a user with no row for an
event simply hasn't answered, which is different from having answered
`not_going`. Clearing an RSVP (`DELETE /api/events/:id/rsvp`) deletes the
row entirely rather than storing a third status value.

## email_verifications

| Column        | Type            | Constraints                          |
| ------------- | --------------- | ------------------------------------- |
| `id`          | BIGINT UNSIGNED | PK, AUTO_INCREMENT                   |
| `user_id`     | BIGINT UNSIGNED | NOT NULL, FK → `users.id`, CASCADE   |
| `token_hash`  | VARCHAR(64)     | NOT NULL, UNIQUE — sha256 hex of the raw emailed token |
| `expires_at`  | DATETIME        | NOT NULL — 24h after issue           |
| `created_at`  | DATETIME        | NOT NULL, default now (UTC)          |

Indexes: `(user_id)` for the resend/cleanup lookup. At most one row per user
at a time — issuing a new token (register, or a resend) deletes any prior
one; a successful verify deletes the row it consumed. Only the hash is
stored, same reasoning as `users.password_hash`.

## Cardinality

| Relationship        | Cardinality  | Enforced by                            |
| -------------------- | ------------ | --------------------------------------- |
| users → events      | one-to-many  | `events.creator_id` FK                 |
| events ↔ tags       | many-to-many | `event_tags` join table                |
| users ↔ events (RSVP) | many-to-many | `event_rsvps` join table, one row per user per event |

## `created_at` / `updated_at` semantics

Both timestamp columns are set by the database, not the application:

```sql
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

`ON UPDATE CURRENT_TIMESTAMP` means every `UPDATE` statement that touches the row
refreshes `updated_at` automatically, including one written directly against the
database for a fix or migration. Relying on the service layer to set it on every
write path is one more thing to forget; letting MySQL own it removes the failure
mode entirely.

## Writes that need a transaction

Creating or updating an event with tags touches `events`, possibly `tags` (for
names not yet seen) and `event_tags`. These run inside a single transaction, so a
failure partway cannot leave an event with half its tags, or a newly created tag
attached to nothing.
