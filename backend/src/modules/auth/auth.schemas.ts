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

const totpCode = z.string().regex(/^\d{6}$/, 'code must be 6 digits');

export const enableTwoFactorSchema = z.object({
  code: totpCode,
});

export const verifyTwoFactorSchema = z.object({
  preAuthToken: z.string().min(1, 'preAuthToken is required'),
  code: totpCode,
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'password is required'),
});
