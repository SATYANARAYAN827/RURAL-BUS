import { z } from 'zod';

export const createScheduleSchema = z.object({
  routeId: z.string().uuid(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be in HH:mm or HH:mm:ss format'),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be in HH:mm or HH:mm:ss format'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day of week is required'),
  baseFare: z.number().positive('Base fare must be positive'),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z.object({
  departureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/).optional(),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  baseFare: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const dispatchTripSchema = z.object({
  routeId: z.string().uuid(),
  busId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  conductorId: z.string().uuid().optional(),
  departureTime: z.string().datetime(),
  scheduledArrival: z.string().datetime(),
});

export type DispatchTripInput = z.infer<typeof dispatchTripSchema>;

export const updateTripStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED']),
});

export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>;

export const tripQuerySchema = z.object({
  routeId: z.string().uuid().optional(),
  busId: z.string().uuid().optional(),
  status: z.enum(['SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type TripQuery = z.infer<typeof tripQuerySchema>;
