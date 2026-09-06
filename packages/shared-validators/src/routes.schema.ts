import { z } from 'zod';

export const geoCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createStopSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  code: z.string().min(2).max(20).toUpperCase().trim(),
  location: geoCoordinatesSchema,
  landmark: z.string().max(255).optional(),
});

export type CreateStopInput = z.infer<typeof createStopSchema>;

export const updateStopSchema = z.object({
  name: z.string().min(2).max(150).trim().optional(),
  code: z.string().min(2).max(20).toUpperCase().trim().optional(),
  location: geoCoordinatesSchema.optional(),
  landmark: z.string().max(255).optional(),
});

export type UpdateStopInput = z.infer<typeof updateStopSchema>;

export const stopQuerySchema = z.object({
  search: z.string().optional(),
});

export const createRouteStopSchema = z.object({
  stopId: z.string().uuid(),
  sequenceNumber: z.number().int().min(1),
  distanceFromStartKm: z.number().nonnegative(),
  estimatedMinutesFromStart: z.number().int().nonnegative(),
  fareFromStart: z.number().nonnegative(),
});

export const createRouteSchema = z.object({
  routeCode: z.string().min(2).max(30).toUpperCase().trim(),
  origin: z.string().min(2).max(150).trim(),
  destination: z.string().min(2).max(150).trim(),
  stops: z.array(createRouteStopSchema).min(2, 'Route must have at least 2 stops'),
  polylineCoordinates: z.array(geoCoordinatesSchema).default([]),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const updateRouteSchema = z.object({
  routeCode: z.string().min(2).max(30).toUpperCase().trim().optional(),
  origin: z.string().min(2).max(150).trim().optional(),
  destination: z.string().min(2).max(150).trim().optional(),
  stops: z.array(createRouteStopSchema).min(2).optional(),
  polylineCoordinates: z.array(geoCoordinatesSchema).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export const routeQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const searchRoutesQuerySchema = z.object({
  originStopId: z.string().uuid().optional(),
  destinationStopId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
});

export type SearchRoutesQuery = z.infer<typeof searchRoutesQuerySchema>;
