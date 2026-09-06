import { z } from 'zod';

export const createStaffSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .trim(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  role: z.enum(['DRIVER', 'CONDUCTOR'], {
    errorMap: () => ({ message: "Role must be either 'DRIVER' or 'CONDUCTOR'" }),
  }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
});

export const updateStaffStatusSchema = z.object({
  isActive: z.boolean(),
});

export const resetStaffPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
});

export const updateOperatorProfileSchema = z.object({
  companyName: z.string().min(2).max(200).trim().optional(),
  contactEmail: z.string().email().toLowerCase().trim().optional(),
  contactPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
});

export const staffQuerySchema = z.object({
  role: z.enum(['DRIVER', 'CONDUCTOR']).optional(),
  search: z.string().optional(),
});

export type CreateStaffSchema = z.infer<typeof createStaffSchema>;
export type UpdateStaffStatusSchema = z.infer<typeof updateStaffStatusSchema>;
export type ResetStaffPasswordSchema = z.infer<typeof resetStaffPasswordSchema>;
export type UpdateOperatorProfileSchema = z.infer<typeof updateOperatorProfileSchema>;
export type StaffQuerySchema = z.infer<typeof staffQuerySchema>;

export const createOperatorSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name cannot exceed 200 characters')
    .trim(),
  ownerName: z
    .string()
    .min(2, 'Owner name must be at least 2 characters')
    .max(100, 'Owner name cannot exceed 100 characters')
    .trim(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
  businessCode: z.string().max(50, 'Business code cannot exceed 50 characters').trim().optional(),
});

export type CreateOperatorSchema = z.infer<typeof createOperatorSchema>;

