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

export const eventFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().max(5000),
  startsAt: z
    .string()
    .min(1, 'Starts at is required')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid date'),
  location: z.string().trim().min(1, 'Location is required').max(255),
  visibility: z.enum(['public', 'private']),
  tags: z.array(z.string()).max(20),
});
export type EventFormValues = z.infer<typeof eventFormSchema>;
