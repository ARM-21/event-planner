/**
 * Validation rules for creating/updating/listing events, using zod. Beyond
 * basic shape checks (required fields, lengths), this also encodes the
 * business rules an event must follow: it has to be scheduled at least 24
 * hours out, and it has to run for at least 15 minutes.
 */

import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid ISO 8601 date');

// Business rule: an event's start time must be committed to at least 24h
// ahead of whenever it's actually set (on create, or on an update that
// touches startsAt) — not just "in the future".
const MIN_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

const leadTimeIsoDate = isoDate.refine(
  (value) => Date.parse(value) - Date.now() >= MIN_LEAD_TIME_MS,
  'startsAt must be at least 24 hours from now',
);

// Business rule: an event must run for at least this long — endsAt merely
// being after startsAt would let a 1-minute "event" through.
export const MIN_DURATION_MS = 15 * 60 * 1000;
const MIN_DURATION_MESSAGE = 'endsAt must be at least 15 minutes after startsAt';

const tagNames = z.array(z.string().trim().min(1).max(50)).max(20);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(150),
    description: z.string().trim().max(5000).optional(),
    startsAt: leadTimeIsoDate,
    endsAt: isoDate,
    location: z.string().trim().min(1, 'location is required').max(255),
    visibility: z.enum(['public', 'private']).optional().default('public'),
    tags: tagNames.optional().default([]),
  })
  .refine((data) => Date.parse(data.endsAt) - Date.parse(data.startsAt) >= MIN_DURATION_MS, {
    message: MIN_DURATION_MESSAGE,
    path: ['endsAt'],
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(150).optional(),
    description: z.string().trim().max(5000).optional(),
    startsAt: leadTimeIsoDate.optional(),
    endsAt: isoDate.optional(),
    location: z.string().trim().min(1, 'location is required').max(255).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    tags: tagNames.optional(),
  })
  // Only catches the case where both are being changed together — when
  // only one of the two is in the request, the route handler checks it
  // against the other's existing stored value instead, since this schema
  // has no way to see the current row.
  .refine(
    (data) => !data.startsAt || !data.endsAt || Date.parse(data.endsAt) - Date.parse(data.startsAt) >= MIN_DURATION_MS,
    { message: MIN_DURATION_MESSAGE, path: ['endsAt'] },
  );

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().min(1).max(150).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  from: isoDate.optional(),
  status: z.enum(['upcoming', 'past']).optional(),
  sort: z.enum(['starts_at', '-starts_at']).optional().default('starts_at'),
});
