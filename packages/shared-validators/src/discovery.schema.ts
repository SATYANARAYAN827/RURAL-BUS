import { z } from 'zod';

export const routeSearchQuerySchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  originStopId: z.string().uuid().optional(),
  destinationStopId: z.string().uuid().optional(),
  date: z.string().optional(),
  operatorId: z.string().uuid().optional(),
});

export const tripDetailParamSchema = z.object({
  tripId: z.string().uuid({ message: 'tripId must be a valid UUID' }),
});
