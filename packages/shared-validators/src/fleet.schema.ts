import { z } from 'zod';

export const createBusSchema = z.object({
  tenantId: z.string().uuid({ message: 'Valid Transport Operator UUID is required' }),
  registrationNumber: z
    .string()
    .min(4)
    .max(30)
    .toUpperCase()
    .trim()
    .regex(/^[A-Z0-9\s\-]+$/, { message: 'Registration number must contain only uppercase letters, digits, hyphens, and spaces' }),
  model: z.string().min(2).max(100).trim(),
  totalSeats: z.number().int().min(10).max(80),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']).default('ACTIVE'),
  seatingType: z.enum(['SEATER_2X2', 'SEATER_3X2', 'SLEEPER', 'SEMI_SLEEPER']).default('SEATER_2X2'),
  amenities: z.array(z.string()).default([]),
});

export type CreateBusInput = z.infer<typeof createBusSchema>;

export const updateBusSchema = z.object({
  tenantId: z.string().uuid().optional(),
  registrationNumber: z
    .string()
    .min(4)
    .max(30)
    .toUpperCase()
    .trim()
    .regex(/^[A-Z0-9\s\-]+$/)
    .optional(),
  model: z.string().min(2).max(100).trim().optional(),
  totalSeats: z.number().int().min(10).max(80).optional(),
  seatingType: z.enum(['SEATER_2X2', 'SEATER_3X2', 'SLEEPER', 'SEMI_SLEEPER']).optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']).optional(),
  amenities: z.array(z.string()).optional(),
});

export type UpdateBusInput = z.infer<typeof updateBusSchema>;

export const busQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']).optional(),
  search: z.string().optional(),
});

export type BusQuery = z.infer<typeof busQuerySchema>;
