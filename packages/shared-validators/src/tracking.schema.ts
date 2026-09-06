import { z } from 'zod';

export const gpsTelemetrySchema = z.object({
  tripId: z.string().uuid(),
  busId: z.string().uuid(),
  tenantId: z.string().uuid(),
  driverId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(200),
  headingDegrees: z.number().min(0).max(360),
  accuracyMeters: z.number().min(0).max(1000),
  timestamp: z.number().int().positive(),
});

export type GPSTelemetryInput = z.infer<typeof gpsTelemetrySchema>;
