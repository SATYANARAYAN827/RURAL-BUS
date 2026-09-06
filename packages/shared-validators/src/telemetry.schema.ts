import { z } from 'zod';

export const gpsPingSchema = z.object({
  tripId: z.string().uuid({ message: 'tripId must be a valid UUID' }),
  latitude: z.coerce
    .number({ invalid_type_error: 'Latitude must be a valid number' })
    .min(-90, { message: 'Latitude must be >= -90' })
    .max(90, { message: 'Latitude must be <= 90' }),
  longitude: z.coerce
    .number({ invalid_type_error: 'Longitude must be a valid number' })
    .min(-180, { message: 'Longitude must be >= -180' })
    .max(180, { message: 'Longitude must be <= 180' }),
  speed: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return 0;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? 0 : num;
    })
    .pipe(
      z
        .number()
        .min(0, { message: 'Speed must be >= 0' })
        .max(200, { message: 'Speed must be <= 200' })
    )
    .default(0),
  heading: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return 0;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? 0 : num;
    })
    .pipe(
      z
        .number()
        .min(0, { message: 'Heading must be >= 0' })
        .max(360, { message: 'Heading must be <= 360' })
    )
    .default(0),
  accuracy: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? undefined : num;
    })
    .pipe(z.number().min(0, { message: 'Accuracy must be >= 0' }).optional()),
  timestamp: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? new Date(val).getTime() : val))
    .refine((val) => !isNaN(val), { message: 'Invalid timestamp' })
    .refine(
      (val) => {
        const now = Date.now();
        return val <= now + 5 * 60 * 1000 && val >= now - 24 * 60 * 60 * 1000;
      },
      { message: 'Timestamp out of acceptable bounds (future > 5m or past > 24h)' }
    )
    .optional()
    .default(() => Date.now()),
});

export const tripLocationParamSchema = z.object({
  tripId: z.string().uuid({ message: 'tripId must be a valid UUID' }),
});

export const wsMessageSchema = z.object({
  type: z.enum([
    'GPS_PING',
    'SUBSCRIBE_TRIP',
    'UNSUBSCRIBE_TRIP',
    'SUBSCRIBE_FLEET',
    'UNSUBSCRIBE_FLEET',
    'PING',
  ]),
  payload: z.any().optional(),
});
