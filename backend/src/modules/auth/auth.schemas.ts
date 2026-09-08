import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.email('invalid email'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  email: emailSchema,
  password: z.string().min(6, 'password must be at least 6 characters').max(72)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
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
