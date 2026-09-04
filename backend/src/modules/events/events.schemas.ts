import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid ISO 8601 date');

const futureIsoDate = isoDate.refine(
  (value) => Date.parse(value) > Date.now(),
  'startsAt must be in the future',
);

const tagNames = z.array(z.string().trim().min(1).max(50)).max(20);

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(150),
  description: z.string().trim().max(5000).optional(),
  startsAt: futureIsoDate,
  location: z.string().trim().min(1, 'location is required').max(255),
  visibility: z.enum(['public', 'private']).optional().default('public'),
  tags: tagNames.optional().default([]),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(150).optional(),
  description: z.string().trim().max(5000).optional(),
  startsAt: futureIsoDate.optional(),
  location: z.string().trim().min(1, 'location is required').max(255).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  tags: tagNames.optional(),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().min(1).max(150).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  from: isoDate.optional(),
  sort: z.enum(['starts_at', '-starts_at']).optional().default('starts_at'),
});
