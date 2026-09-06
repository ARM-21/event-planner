import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

const isoDateTimeLocal = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid date');

export const MIN_LEAD_TIME_MS = 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 15 * 60 * 1000;

const baseEventFields = {
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().max(5000),
  startsAt: isoDateTimeLocal('Starts at'),
  endsAt: isoDateTimeLocal('Ends at'),
  location: z.string().trim().min(1, 'Location is required').max(255),
  visibility: z.enum(['public', 'private']),
  tags: z.array(z.string()).max(20),
};

// endsAt >= startsAt + 15min 
const endsAfterStarts = (data: { startsAt: string; endsAt: string }) =>
  Date.parse(data.endsAt) - Date.parse(data.startsAt) >= MIN_DURATION_MS;

export const eventFormSchema = z.object(baseEventFields).refine(endsAfterStarts, {
  message: 'Ends at must be at least 15 minutes after the start time',
  path: ['endsAt'],
});
export type EventFormValues = z.infer<typeof eventFormSchema>;

// Create-only: startsAt must be at least 24h from now.
export const createEventFormSchema = z
  .object(baseEventFields)
  .refine(endsAfterStarts, { message: 'Ends at must be at least 15 minutes after the start time', path: ['endsAt'] })
  .refine((data) => Date.parse(data.startsAt) - Date.now() >= MIN_LEAD_TIME_MS, {
    message: 'Starts at must be at least 24 hours from now',
    path: ['startsAt'],
  });
