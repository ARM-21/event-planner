# Database schema

Here is the schema diagram of the tables and their relationships:
```
users ──< events ──< event_tags >── tags
users >── event_rsvps ──< events   (one row per user per event)
users ──< refresh_tokens
users ──< email_verifications
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
| `totp_secret`   | VARCHAR(255)        | NULL, AES-256-GCM encrypted TOTP secret (`iv.tag.ciphertext`), set by `POST /auth/2fa/setup` |
| `two_factor_enabled` | BOOLEAN        | NOT NULL, default `false` |
| `created_at`    | DATETIME            | NOT NULL, default now (UTC) |
| `updated_at`    | DATETIME            | NOT NULL, default now (UTC), auto-updated |

Refresh-token revocation is tracked per-session in `refresh_tokens` below,
not on `users` — see that section and "Auth tokens" in `docs/api-contract.md`.

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

## refresh_tokens

| Column           | Type            | Constraints                          |
| ---------------- | --------------- | ------------------------------------- |
| `id`             | BIGINT UNSIGNED | PK, AUTO_INCREMENT                   |
| `user_id`        | BIGINT UNSIGNED | NOT NULL, FK → `users.id`, CASCADE   |
| `token_hash`     | VARCHAR(64)     | NOT NULL, UNIQUE — sha256 hex of the raw cookie value |
| `device_label`   | VARCHAR(255)    | NULL — `User-Agent` at issue time    |
| `ip`             | VARCHAR(45)     | NULL — caller's IP at issue time     |
| `expires_at`     | DATETIME        | NOT NULL — 30 days after issue       |
| `created_at`     | DATETIME        | NOT NULL, default now (UTC)          |
| `revoked_at`     | DATETIME        | NULL — set on logout, rotation, or reuse-detection sweep |
| `replaced_by_id` | BIGINT UNSIGNED | NULL, FK → `refresh_tokens.id`, self-referential, `SET NULL` on delete |

Indexes: `(user_id)`. One row per active session/device — this is what
makes per-device logout and revocation possible, unlike the single global
`token_version` counter this table replaced.

Every `POST /auth/refresh` call **rotates**: the presented token is looked
up by hash, marked `revoked_at`, and a brand-new row is inserted and linked
back via `replaced_by_id`, so the chain of a session's tokens is
reconstructable. This also enables **reuse detection** — if a token whose
`replaced_by_id` is already set gets presented again (the legitimate client
already rotated past it, so this can only mean the token leaked and an
attacker is using a stale copy), every active token for that `user_id` is
revoked immediately, forcing a fresh login on every device. A token revoked
by an ordinary logout (`replaced_by_id` still `NULL`) does *not* trigger
this — that's just an already-ended session, not a theft signal.

`POST /auth/logout` revokes only the caller's own row, not every session —
other logged-in devices are unaffected. Rows are never deleted, only
revoked; there's no cleanup job for expired/revoked rows in this version
(see the README's Assumptions section).

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
