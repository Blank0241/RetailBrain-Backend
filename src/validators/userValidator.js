import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email('Enter a valid email address.').max(254).optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'Provide at least one field to update.',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(200),
});
