/**
 * Validation rules for the register/login request bodies, using zod.
 * These run before any database or business logic — if the input doesn't
 * match, the request is rejected with a 400 and a per-field error message
 * before touching the database at all.
 */

import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.email('invalid email'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  email: emailSchema,
  password: z.string().min(8, 'password must be at least 8 characters').max(72),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password is required'),
});
