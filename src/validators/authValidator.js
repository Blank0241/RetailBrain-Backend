import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  // "remember" is collected by the Login form but doesn't change server
  // behavior today (session length is fixed by JWT_EXPIRES_IN). Accepted so
  // validation doesn't reject the extra field.
  remember: z.boolean().optional(),
});
